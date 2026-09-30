// Types and catalogs shared by the server and the web client.
import type { GameSpec } from "./game";
import type { AppSpec } from "./app";
import type { SceneSpec, StorySpec } from "./creations";

// ---------- Permissions (granular, parent-controlled) ----------

export type HomeworkMode = "teach" | "hints" | "answers";

export interface Permissions {
  aiQuestions: boolean;
  imageGeneration: boolean;
  storyCreation: boolean;
  gameCreation: boolean;
  appCreation: boolean;
  aiGuideInApps: boolean;
  projectSharing: boolean; // private links
  friendSharing: boolean; // links a friend can open and play
  friendRemix: boolean;
  publicPublishing: boolean;
  shareNeedsApproval: boolean;
  showCreatorName: boolean;
  emailSharing: boolean; // only to parent-approved contacts
  photoUpload: boolean; // homework photos
  homeworkMode: HomeworkMode;
  github: boolean;
  webAccess: boolean;
  aiAgents: boolean;
  dailyAiLimit: number;
}

export const PERMISSION_INFO: { key: keyof Permissions; label: string; group: string; help: string; future?: boolean }[] = [
  { key: "aiQuestions", label: "Ask AI questions", group: "AI", help: "Explore and Learn modes." },
  { key: "imageGeneration", label: "Make pictures", group: "Create", help: "AI-composed picture scenes." },
  { key: "storyCreation", label: "Write stories with AI", group: "Create", help: "" },
  { key: "gameCreation", label: "Build games", group: "Build", help: "" },
  { key: "appCreation", label: "Make apps", group: "Build", help: "" },
  { key: "aiGuideInApps", label: "AI guides inside apps", group: "Build", help: "Lets apps include a small AI helper (only works inside SparkForge, never on share pages)." },
  { key: "projectSharing", label: "Share with family (private links)", group: "Sharing", help: "Unlisted links for people you send them to." },
  { key: "friendSharing", label: "Share with friends", group: "Sharing", help: "Friends can open and play shared creations." },
  { key: "friendRemix", label: "Friends can remix", group: "Sharing", help: "Friends using SparkForge can make their own copy." },
  { key: "shareNeedsApproval", label: "I approve every share first", group: "Sharing", help: "Links stay off until you approve them." },
  { key: "showCreatorName", label: "Show first name on shared pages", group: "Sharing", help: "Otherwise shown as “a young creator”." },
  { key: "publicPublishing", label: "Public publishing", group: "Sharing", help: "A public project URL. Off by default." },
  { key: "emailSharing", label: "Send to approved contacts", group: "Connectors", help: "Only people you add below." },
  { key: "photoUpload", label: "Upload homework photos", group: "Learn", help: "" },
  { key: "github", label: "GitHub", group: "Connectors", help: "Real code repositories.", future: true },
  { key: "webAccess", label: "Web access for AI", group: "AI", help: "Let AI look things up on the web.", future: true },
  { key: "aiAgents", label: "AI agents", group: "AI", help: "Multi-step AI helpers.", future: true },
];

export function defaultPermissions(age: number): Permissions {
  const young = age < 8;
  return {
    aiQuestions: true,
    imageGeneration: true,
    storyCreation: true,
    gameCreation: true,
    appCreation: true,
    aiGuideInApps: !young,
    projectSharing: true,
    friendSharing: !young,
    friendRemix: false,
    publicPublishing: false,
    shareNeedsApproval: young,
    showCreatorName: true,
    emailSharing: false,
    photoUpload: !young,
    homeworkMode: "teach",
    github: false,
    webAccess: false,
    aiAgents: false,
    dailyAiLimit: young ? 60 : 120,
  };
}

// ---------- AI help level ----------

export type HelpLevel = "do" | "help" | "teach" | "challenge";
export const HELP_LEVELS: { id: HelpLevel; emoji: string; label: string; about: string }[] = [
  { id: "do", emoji: "🟢", label: "Do it for me", about: "Fastest" },
  { id: "help", emoji: "🟡", label: "Help me", about: "Hints and partial solutions" },
  { id: "teach", emoji: "🔵", label: "Teach me", about: "Step-by-step explanations" },
  { id: "challenge", emoji: "🔴", label: "Challenge me", about: "Minimal help" },
];

// ---------- Profiles ----------

export type Experience = "beginner" | "some" | "experienced";

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  avatar: string;
  experience: Experience;
  interests: string[];
  helpLevel: HelpLevel;
  permissions: Permissions;
}

export type ProjectType = "game" | "app" | "image" | "story";
export type ProjectSpec = GameSpec | AppSpec | SceneSpec | StorySpec;

export interface ProjectSummary {
  id: string;
  type: ProjectType;
  title: string;
  emoji: string;
  version: number;
  updatedAt: string;
  remixedFrom: string | null;
}

export interface Project extends ProjectSummary {
  idea: string;
  description: string;
  spec: ProjectSpec;
  childId: string;
}

export interface ProjectVersion {
  version: number;
  summary: string;
  author: "ai" | "child" | "fix";
  createdAt: string;
}

export type JournalKind = "idea" | "ai" | "changed" | "learned" | "solved";
export interface JournalEntry {
  kind: JournalKind;
  text: string;
  createdAt: string;
}

// ---------- Creator progression ----------

export const CREATOR_LEVELS = [
  { id: "explorer", emoji: "🌱", label: "Explorer", about: "Asks questions and discovers topics" },
  { id: "creator", emoji: "🎨", label: "Creator", about: "Makes pictures, stories and creations" },
  { id: "builder", emoji: "🧩", label: "Builder", about: "Builds games, apps and interactive things" },
  { id: "engineer", emoji: "🛠️", label: "Engineer", about: "Reads code, tests and debugs" },
  { id: "ai-engineer", emoji: "🤖", label: "AI Engineer", about: "Builds with AI and checks what AI says" },
  { id: "inventor", emoji: "🚀", label: "Inventor", about: "Ships real projects others use" },
] as const;
export type CreatorLevelId = (typeof CREATOR_LEVELS)[number]["id"];

export interface Medal {
  id: string;
  emoji: string;
  title: string;
  about: string;
  hidden?: boolean;
  future?: boolean;
}

export const MEDALS: Medal[] = [
  { id: "first-creation", emoji: "🥇", title: "First Creation", about: "Create your first project." },
  { id: "game-maker", emoji: "🎮", title: "Game Maker", about: "Create and play your first game." },
  { id: "app-maker", emoji: "📱", title: "App Maker", about: "Build your first app." },
  { id: "bug-hunter", emoji: "🐛", title: "Bug Hunter", about: "Find and fix a bug." },
  { id: "curious-mind", emoji: "🧠", title: "Curious Mind", about: "Explore one topic deeply (5 questions)." },
  { id: "creator", emoji: "🎨", title: "Creator", about: "Make 5 pictures or stories." },
  { id: "builder", emoji: "🔧", title: "Builder", about: "Build a project through 3 versions." },
  { id: "mission-complete", emoji: "🚀", title: "Mission Complete", about: "Finish a mission." },
  { id: "experimenter", emoji: "🧪", title: "Experimenter", about: "Try two different game types." },
  { id: "improver", emoji: "🔄", title: "Improver", about: "Test your game, change it, and test again." },
  { id: "ai-collaborator", emoji: "🤖", title: "AI Collaborator", about: "Improve a project with AI 5 times." },
  { id: "problem-solver", emoji: "🧩", title: "Problem Solver", about: "Fix a bug yourself, without the automatic fix." },
  { id: "publisher", emoji: "🌍", title: "Publisher", about: "Publish a project." },
  { id: "first-share", emoji: "👋", title: "First Share", about: "Share a creation with someone." },
  { id: "inspiration", emoji: "💫", title: "Inspiration", about: "Someone remixed your creation." },
  { id: "community-helper", emoji: "🫶", title: "Community Helper", about: "Help another creator.", future: true },
  { id: "creator-milestone", emoji: "🏆", title: "Creator Milestone", about: "Complete 10 projects." },
  // Surprise achievements — discovered, not announced.
  { id: "i-broke-it", emoji: "💥", title: "I Broke It", about: "Went back to an older version after an experiment.", hidden: true },
  { id: "try-again", emoji: "🔥", title: "Try Again", about: "Lost a game, then came back and won it.", hidden: true },
  { id: "ai-detective", emoji: "🕵️", title: "AI Detective", about: "Caught an AI mistake.", hidden: true },
  { id: "i-understand", emoji: "💡", title: "I Understand", about: "Explained how your project works in your own words.", hidden: true },
  { id: "my-idea", emoji: "🌟", title: "My Idea", about: "Changed an AI-made project a lot, by yourself.", hidden: true },
];

export const CONCEPTS: Record<string, { emoji: string; young: string; older: string }> = {
  Variables: { emoji: "📦", young: "A variable is a box with a name that remembers something, like your score.", older: "A variable is a named piece of memory. Your game changes it (score = score + 1) and reads it to decide what to show." },
  Movement: { emoji: "🏃", young: "Things move when the game changes where they are, a tiny bit, many times a second.", older: "Movement is position updated every frame: x = x + speed. Bigger speed, bigger steps." },
  Collisions: { emoji: "💥", young: "The game checks if two things touch. If they do, something happens!", older: "Collision detection checks whether two shapes overlap each frame, then triggers an event." },
  Events: { emoji: "⚡", young: "An event is something that happens — a tap, a bump, a timer — and the app reacts.", older: "Events are signals (key press, click, collision). Code 'listens' and runs a handler when they fire." },
  Conditions: { emoji: "🔀", young: "IF something is true, THEN do this. Like: IF lives are 0, THEN game over.", older: "Conditions (if/else) choose between paths based on data: if (lives === 0) gameOver()." },
  Loops: { emoji: "🔁", young: "A loop does something again and again — like playing level after level.", older: "Loops repeat work. Games run a loop ~60 times a second; levels are a loop over a list." },
  Timers: { emoji: "⏱️", young: "A timer counts down. When it reaches zero, something happens.", older: "Timers subtract elapsed time each frame and fire an event at zero." },
  Data: { emoji: "🗂️", young: "Data is information your project keeps, like a list of animals.", older: "Structured data (lists of objects with fields) separates content from the code that shows it." },
  "Game Design": { emoji: "🎯", young: "Game design is deciding the goal, the challenge and what makes it fun.", older: "Game design balances goals, challenge and reward so play feels fair and exciting." },
  "User Interfaces": { emoji: "🖥️", young: "The interface is what people see and tap.", older: "A UI is the layer people interact with: layout, text, buttons, feedback." },
  Components: { emoji: "🧱", young: "Components are building blocks you can reuse, like LEGO.", older: "Components are reusable UI pieces with their own inputs — cards, lists, buttons." },
  Navigation: { emoji: "🧭", young: "Navigation is how you move between screens.", older: "Navigation maps actions to screens, like routes in a web app." },
  Search: { emoji: "🔍", young: "Search finds the things that match what you type.", older: "Search filters a collection by comparing each item to a query." },
  "User Input": { emoji: "⌨️", young: "Input is when the app lets you type and remembers it.", older: "Input fields capture user data into state variables the app can use." },
  "AI Models": { emoji: "🤖", young: "An AI model learned from lots of examples and makes guesses — good ones, but not always right.", older: "A model predicts likely outputs from patterns in training data. It can be confidently wrong, so verify." },
  "AI Prompting": { emoji: "💬", young: "Prompting is telling AI clearly what you want.", older: "A prompt gives a model the task, context and constraints. Clear prompts get better results." },
  "AI Verification": { emoji: "🕵️", young: "AI can make mistakes. Good creators double-check!", older: "Verification means checking AI claims against reliable sources before trusting them." },
  Debugging: { emoji: "🐛", young: "Debugging means finding why something doesn't work and fixing it.", older: "Debugging: reproduce the problem, form a guess about the cause, test it, fix it." },
  Testing: { emoji: "✅", young: "Testing means checking your project works the way you want.", older: "Tests ask specific questions (can I win? can I lose?) and report pass or fail." },
  "Version Control": { emoji: "🕰️", young: "Every version is saved, so you can always go back.", older: "Version control records each change so you can compare, undo and experiment safely." },
  Prompting: { emoji: "🎨", young: "Describing your picture clearly helps AI make it.", older: "Image prompts combine subject, setting and style." },
};

export interface MissionStepDef {
  title: string;
  task: string;
  check: string; // server-side check id
}

export interface MissionDef {
  id: string;
  emoji: string;
  title: string;
  about: string;
  topic: string;
  skills: string[];
  steps: MissionStepDef[];
}

export const MISSIONS: MissionDef[] = [
  {
    id: "mars-explorer",
    emoji: "🚀",
    title: "Build a Mars Explorer",
    about: "Learn about Mars, design a world, and build a game with an AI guide.",
    topic: "Mars",
    skills: ["Game Design", "Variables", "Data", "AI Models", "Testing"],
    steps: [
      { title: "Discover Mars", task: "Ask 3 questions about Mars in Explore.", check: "ask:mars:3" },
      { title: "Design", task: "Make a picture of your Mars world.", check: "image:mars" },
      { title: "Build", task: "Build a game about Mars.", check: "game:mars" },
      { title: "Add Logic", task: "Change your Mars game (with AI or in Build mode).", check: "modified:game:mars" },
      { title: "Add Data", task: "Give at least 3 collectibles a real Mars fact.", check: "facts:mars:3" },
      { title: "Add AI", task: "Make a Mars app with an 🤖 AI Guide block.", check: "aiguide:mars" },
      { title: "Test", task: "Run the tests on a Mars project 3 times.", check: "tested:mars:3" },
      { title: "Publish", task: "Share a Mars creation.", check: "shared:mars" },
    ],
  },
  {
    id: "star-catcher",
    emoji: "⭐",
    title: "Star Catcher",
    about: "Build a catching game, then make it harder — and debug it.",
    topic: "Stars",
    skills: ["Movement", "Collisions", "Variables", "Loops", "Debugging"],
    steps: [
      { title: "Build", task: "Create a Catcher game about stars.", check: "gamekind:catcher" },
      { title: "Play", task: "Play your game once.", check: "played:1" },
      { title: "Make it harder", task: "Add a danger or a level.", check: "modified:game:any" },
      { title: "Test", task: "Run the tests on your game.", check: "tested:any:1" },
      { title: "Debug", task: "Fix a bug.", check: "fixed:1" },
    ],
  },
  {
    id: "animal-explorer",
    emoji: "🦁",
    title: "Animal Explorer",
    about: "Build an information app about animals with search and detail pages.",
    topic: "Animals",
    skills: ["Data", "Search", "Navigation", "User Interfaces"],
    steps: [
      { title: "Plan", task: "Make an app about animals.", check: "app:animal" },
      { title: "Search", task: "Your app has a 🔍 Search block.", check: "appblock:search" },
      { title: "Grow the data", task: "Your app has at least 6 items.", check: "appitems:6" },
      { title: "Share", task: "Share your app.", check: "shared:app" },
    ],
  },
  {
    id: "ai-detective",
    emoji: "🕵️",
    title: "AI Detective",
    about: "AI can be wrong. Spot the mistake hiding among true facts.",
    topic: "AI",
    skills: ["AI Verification", "AI Models"],
    steps: [
      { title: "First case", task: "Solve one AI Detective case.", check: "detective:1" },
      { title: "Sharp eyes", task: "Solve 3 cases.", check: "detective:3" },
    ],
  },
];

export interface Notification {
  id: string;
  emoji: string;
  text: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface SafetyAlert {
  id: string;
  childId: string;
  childName: string;
  severity: "low" | "medium" | "high";
  category: string;
  summary: string;
  excerpt: string;
  reviewed: boolean;
  createdAt: string;
}
