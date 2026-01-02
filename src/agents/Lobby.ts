import { Agent, callable, getAgentByName } from "agents";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
  colors,
} from "unique-names-generator";
import { GameAgent, GameState } from "./Game";

export type LobbyState = {
  gamesSeekingPlayers: GameState[];
  gamesInProgress: GameState[];
};

export class LobbyAgent extends Agent<Env, LobbyState> {
  initialState = {
    gamesSeekingPlayers: [],
    gamesInProgress: [],
  };
  onStart(): void {
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS games (
      slug TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    );`);
  }
  generateGameSlug(): string {
    return uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: "-",
      length: 3,
    });
  }

  @callable()
  async createGame(): Promise<string> {
    const slug = this.generateGameSlug();
    const game = await getAgentByName<Env, GameAgent>(this.env.GameAgent, slug);
    await game.setup({ slug });
    this.sql`INSERT INTO games (slug) VALUES ${slug}`;
    const gamesSeekingPlayers = this.state.gamesSeekingPlayers;
    gamesSeekingPlayers.unshift({
      slug,
      waitingForPlayers: true,
      inProgress: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.setState({
      ...this.state,
      gamesSeekingPlayers: gamesSeekingPlayers.slice(0, 5),
    });
    return slug;
  }

  @callable()
  async allGameSlugs(): Promise<string[]> {
    const rows = this.sql<{
      slug: string;
    }>`SELECT slug FROM games ORDER BY createdAt DESC`;
    return rows.map((row) => row.slug);
    return [];
  }

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
