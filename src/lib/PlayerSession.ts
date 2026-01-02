const PLAYER_NAME_KEY = "tictactoe_player_name";
export function getPlayerName(): string {
  if (typeof window === "undefined") return generatePlayerName();

  let name = sessionStorage.getItem(PLAYER_NAME_KEY);
  if (!name) {
    name = generatePlayerName();
    sessionStorage.setItem(PLAYER_NAME_KEY, name);
  }
  return name;
}
function generatePlayerName(): string {
  const adjectives = ["Swift", "Bold", "Clever", "Lucky", "Mighty"];
  const nouns = ["Fox", "Eagle", "Tiger", "Dragon", "Phoenix"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}
