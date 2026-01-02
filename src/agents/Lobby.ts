import { Agent, callable, getAgentByName } from "agents";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
  colors,
} from "unique-names-generator";
import { GameAgent, GameState } from "./Game";
import { PlayerType } from "@/types";

/**
 * LobbyState represents the current state of the game lobby.
 * Maintains lists of active games in different states for display to users.
 */
export type LobbyState = {
  /** Games waiting for a second player to join (human vs human) */
  gamesSeekingPlayers: GameState[];
  /** Games that are currently being played (includes AI games) */
  gamesInProgress: GameState[];
};

/**
 * LobbyAgent is a singleton Cloudflare Durable Object that manages the game lobby.
 * There is only one instance (named "lobby") that coordinates all active games.
 * 
 * Responsibilities:
 * - Create new games and generate unique identifiers
 * - Track which games are seeking players vs in progress
 * - Maintain a persistent list of all games in SQL storage
 * - Clean up completed/deleted games
 * - Provide lobby state to clients for display
 */
export class LobbyAgent extends Agent<Env, LobbyState> {
  /**
   * Default state for the lobby with empty game lists.
   * Gets populated as games are created.
   */
  initialState = {
    gamesSeekingPlayers: [],
    gamesInProgress: [],
  };

  /**
   * Lifecycle hook called when the Durable Object is first created.
   * Sets up the SQL database schema for storing game metadata.
   */
  onStart(): void {
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS games (
        slug TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );`);
  }

  /**
   * Generates a unique, human-readable identifier for a new game.
   * Uses a combination of adjective + color + animal (e.g., "happy-blue-dolphin").
   * 
   * @returns {string} A unique game slug with 3 words separated by hyphens
   * 
   * @example
   * generateGameSlug() // => "brave-red-tiger"
   */
  generateGameSlug(): string {
    return uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: "-",
      length: 3,
    });
  }

  /**
   * Creates a new game and adds it to the lobby.
   * Callable from the client via RPC.
   * 
   * Human opponent games are added to "seeking players" list.
   * AI opponent games are immediately added to "in progress" list.
   * 
   * Both lists are limited to the 5 most recent games for display purposes.
   * 
   * @param {PlayerType} opponentType - Type of opponent (HUMAN or AI)
   * @returns {Promise<string>} The unique slug identifier for the created game
   */
  @callable()
  async createGame(opponentType: PlayerType): Promise<string> {
    const slug = this.generateGameSlug();
    console.log(`[LobbyAgent] Create new game with slug ${slug}`);

    const game = await getAgentByName<Env, GameAgent>(this.env.GameAgent, slug);
    await game.setup({ slug });

    this.sql`INSERT INTO games (slug) VALUES (${slug})`;

    const gamesSeekingPlayers = this.state.gamesSeekingPlayers;
    const gamesInProgress = this.state.gamesInProgress;

    if (opponentType === PlayerType.HUMAN) {
      gamesSeekingPlayers.unshift({
        slug,
        waitingForPlayers: true,
        inProgress: false,
        createdAt: (await game.state).createdAt,
        updatedAt: (await game.state).updatedAt,
      });
    } else {
      gamesInProgress.unshift({
        slug,
        waitingForPlayers: false,
        inProgress: true,
        createdAt: (await game.state).createdAt,
        updatedAt: (await game.state).updatedAt,
      });
    }

    this.setState({
      ...this.state,
      gamesSeekingPlayers: gamesSeekingPlayers.slice(0, 5),
      gamesInProgress: gamesInProgress.slice(0, 5),
    });

    return slug;
  }

  /**
   * Retrieves all game slugs from the database, ordered by creation time.
   * Callable from the client via RPC.
   * 
   * Useful for administrative purposes or debugging to see all games
   * that have ever been created (not just the ones in the lobby state).
   * 
   * @returns {Promise<string[]>} Array of game slugs, newest first
   */
  @callable()
  async allGameSlugs(): Promise<string[]> {
    const rows = this.sql<{
      slug: string;
    }>`SELECT slug FROM games ORDER BY createdAt DESC`;
    return rows.map((row) => row.slug);
  }

  /**
   * Deletes a game and removes it from the lobby and database.
   * Callable from the client via RPC.
   * 
   * This method:
   * 1. Calls the GameAgent's delete() method to destroy the Durable Object
   * 2. Removes the game from the SQL database
   * 3. Filters the game out of both lobby state lists
   * 
   * @param {string} slug - The unique identifier of the game to delete
   * @returns {Promise<void>}
   * @throws {Error} If no slug is provided
   */
  @callable()
  async deleteGame(slug: string): Promise<void> {
    if (!slug) {
      throw new Error("No slug provided");
    }
    const game = await getAgentByName<Env, GameAgent>(this.env.GameAgent, slug);
    await game.delete();
    this.sql`DELETE FROM games WHERE slug = ${slug}`;
    this.setState({
      gamesSeekingPlayers: this.state.gamesSeekingPlayers.filter(
        (game) => game.slug !== slug
      ),
      gamesInProgress: this.state.gamesInProgress.filter(
        (game) => game.slug !== slug
      ),
    });
  }
}
