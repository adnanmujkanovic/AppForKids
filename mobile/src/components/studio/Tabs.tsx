// Project studio tabs for phones. The same flows as the web app, built with native components.
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Linking, Platform, Share, Text, TextInput, View } from "react-native";
import { api, errorText, serverUrl } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useSession } from "../../lib/session";
import { useRewards, type Rewards } from "../Rewards";
import { AppView } from "../AppView";
import { CodeView, GameView, type RunError } from "../GameView";
import { SceneView } from "../SceneView";
import { StoryView } from "../StoryView";
import { Button, C, Card, Chip, H3, Muted, Note, P, Row, s, timeAgo } from "../ui";
import { AppEditor, CodeEditor, GameEditor, SceneEditor, StoryEditor } from "./Editors";
import { appCode, gameCode } from "../../../../shared/codeText";
import type { GameBug, GameCheck, GameSpec } from "../../../../shared/game";
import type { AppSpec } from "../../../../shared/app";
import type { CodeSpec, SceneSpec, StorySpec } from "../../../../shared/creations";
import { CONCEPTS, type JournalEntry, type Permissions, type Project, type ProjectVersion } from "../../../../shared/types";

export interface Detail {
  project: Project;
  versions: ProjectVersion[];
  journal: JournalEntry[];
  shares: { token: string; audience: string; status: string; allowRemix: boolean; slug: string | null; views: number; plays: number; createdAt: string }[];
  concepts: string[];
  permissions: Permissions;
  role: "owner" | "collaborator";
  owner: string | null;
  collaborators: { id: string; name: string; avatar: string; role: string }[];
  tasks: { id: string; text: string; assignee: string | null; done: boolean }[];
  reactions: { kind: string; value: string; n: number }[];
  deployment: { repo: string; repoUrl: string; pagesUrl: string | null } | null;
  githubReady: boolean;
}

type Done = (r: Rewards | null) => Promise<void>;

export function focusSection(where: string | undefined) {
  if (!where) return "";
  if (where.startsWith("screens.")) return where;
  const head = where.split(".")[0];
  return head === "theme" ? "look" : head;
}

/** Renders any project for playing / viewing. */
export function Viewer({ p, onEnd, runId = 0, onRan }: { p: Project; onEnd?: (r: { result: "won" | "lost"; score: number }) => void; runId?: number; onRan?: (ok: boolean, e?: RunError) => void }) {
  if (p.type === "game") return <GameView key={p.version} spec={p.spec as GameSpec} onEnd={onEnd} />;
  if (p.type === "code") return <CodeView spec={p.spec as CodeSpec} runId={runId} onRan={onRan} />;
  if (p.type === "app") return <AppView key={p.version} spec={p.spec as AppSpec} ask={async (question) => (await api.post<{ reply: string }>(`/kid/guide/${p.id}`, { question })).reply} />;
  if (p.type === "image") {
    const sc = p.spec as SceneSpec;
    return (
      <Card style={{ padding: 10 }}>
        <SceneView scene={sc} />
        <P style={{ textAlign: "center", fontWeight: "700" }}>{sc.caption}</P>
        <Muted style={{ textAlign: "center" }}>🤖 Composed by AI from your idea, drawn as emoji art.</Muted>
      </Card>
    );
  }
  return <StoryView story={p.spec as StorySpec} />;
}

export function PlayTab({ p, onImprove }: { p: Project; onImprove: () => void }) {
  const showRewards = useRewards();
  const [ended, setEnded] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  return (
    <View style={{ gap: 12 }}>
      <Viewer
        p={p}
        runId={runId}
        onEnd={async (r) => {
          setEnded(r.result);
          const out = await api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/played`, r).catch(() => null);
          showRewards(out?.rewards ?? null);
        }}
        onRan={(ok, e) => api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/ran`, { ok, error: e?.message ?? "" }).then((r) => showRewards(r.rewards)).catch(() => {})}
      />
      {p.type === "code" ? <Button variant="ghost" title="↻ Run again" onPress={() => setRunId((n) => n + 1)} /> : null}
      {ended || p.type !== "game" ? (
        <Card tint="violet" style={{ alignItems: "center" }}>
          <H3>{ended === "won" ? "Too easy? 😎" : ended === "lost" ? "Too hard? 🤔" : "What should we improve?"}</H3>
          <Muted>Every great creator tests, then improves.</Muted>
          <Button title="🧩 Improve it" onPress={onImprove} />
        </Card>
      ) : null}
    </View>
  );
}

export function BugCard({ bug, onFix, onTry }: { bug: GameBug; onFix: () => Promise<void>; onTry: () => void }) {
  const [shown, setShown] = useState<"hint" | "why" | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card style={{ borderColor: C.coral, borderWidth: 2 }}>
      <Chip tone="coral" label="🐛 BUG FOUND" />
      <H3 style={{ color: "#b3261e" }}>{bug.title.replace(/^🐛\s*/, "")}</H3>
      <Row>
        <Button size="sm" variant="mint" title="🛠️ Let me try" onPress={onTry} />
        <Button size="sm" variant="sun" title="💡 Give me a hint" onPress={() => setShown("hint")} />
        <Button size="sm" variant="sky" title="🔍 Explain why" onPress={() => setShown("why")} />
        <Button size="sm" variant="ghost" title="🤖 Fix it for me" disabled={busy} onPress={async () => { setBusy(true); await onFix(); setBusy(false); }} />
      </Row>
      {shown === "hint" ? <Note>💡 {bug.hint}</Note> : null}
      {shown === "why" ? <Card tint="sky"><P>🔍 {bug.explanation}</P><Chip tone="sky" label={bug.concept} /></Card> : null}
    </Card>
  );
}

interface ChangeResult { understood: boolean; summary?: string; explanation: string; concept?: string; newBugs?: GameCheck[]; note?: string; project?: Project; rewards?: Rewards }

function AgentPanel({ p, onDone, onReplace }: { p: Project; onDone: Done; onReplace: (x: Project) => void }) {
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState<{ title: string; request: string; why: string; state?: string; detail?: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);
  return (
    <Card>
      <H3>🦾 AI Agent</H3>
      <Muted>Give a bigger goal. The agent makes a plan, you approve it, then it builds one step at a time.</Muted>
      {!steps ? (
        <>
          <TextInput style={s.input} value={goal} onChangeText={setGoal} placeholder="Make it harder and add aliens" placeholderTextColor={C.ink3} />
          <Button title={busy ? "Planning…" : "Plan"} disabled={busy || goal.trim().length < 3} onPress={async () => {
            setBusy(true);
            setErr(null);
            try {
              setSteps((await api.post<{ plan: { steps: { title: string; request: string; why: string }[] } }>(`/kid/projects/${p.id}/agent/plan`, { goal })).plan.steps);
            } catch (e) {
              setErr(errorText(e));
            } finally {
              setBusy(false);
            }
          }} />
        </>
      ) : (
        <>
          {steps.map((x, i) => (
            <Row key={i} wrap={false} style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900" }}>{x.state === "done" ? "✅" : x.state === "doing" ? "⏳" : x.state === "skipped" ? "⏭️" : "⬜"} {i + 1}. {x.title}</Text>
                <Muted>{x.detail ?? x.why}</Muted>
              </View>
              {!busy && !x.state ? <Button size="sm" variant="danger" title="✕" onPress={() => setSteps(steps.filter((_, j) => j !== i))} /> : null}
            </Row>
          ))}
          {busy ? (
            <Button variant="ghost" title="⏹ Stop after this step" onPress={() => { stop.current = true; }} />
          ) : steps.some((x) => !x.state) ? (
            <Row>
              <Button variant="mint" title="✅ Approve & build" disabled={!steps.length} onPress={async () => {
                setBusy(true);
                stop.current = false;
                const out = [...steps];
                for (let i = 0; i < out.length && !stop.current; i++) {
                  out[i] = { ...out[i], state: "doing" };
                  setSteps([...out]);
                  try {
                    const r = await api.post<ChangeResult>(`/kid/projects/${p.id}/ai-change`, { request: out[i].request });
                    out[i] = { ...out[i], state: r.understood ? "done" : "skipped", detail: r.understood ? r.summary : r.explanation };
                    if (r.project) onReplace(r.project);
                    if (r.understood) await onDone(r.rewards ?? null);
                  } catch (e) {
                    out[i] = { ...out[i], state: "skipped", detail: errorText(e) };
                  }
                  setSteps([...out]);
                }
                setBusy(false);
              }} />
              <Button variant="ghost" title="Change goal" onPress={() => setSteps(null)} />
            </Row>
          ) : (
            <Button variant="ghost" title="New goal" onPress={() => { setSteps(null); setGoal(""); }} />
          )}
        </>
      )}
      {err ? <Note>{err}</Note> : null}
    </Card>
  );
}

export function BuildTab({ d, focus, saving, onSave, onDone, onFocus, onReplace }: {
  d: Detail;
  focus: string;
  saving: boolean;
  onSave: (spec: unknown) => Promise<void>;
  onDone: Done;
  onFocus: (f: string) => void;
  onReplace: (p: Project) => void;
}) {
  const p = d.project;
  const showRewards = useRewards();
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChangeResult | null>(null);
  const [runError, setRunError] = useState<RunError | null>(null);
  const [runId, setRunId] = useState(0);
  const examples: Record<string, string[]> = {
    game: ["Make it faster", "Add rocks", "Add 2 levels", "Add a 60 second timer", "Make it harder", "More lives"],
    app: ["Add search", "Add an about screen", "Ask for my name", "Make it blue", "Add an AI guide"],
    image: ["Add a rainbow", "Make it night time", "Add a friendly alien"],
    story: ["Make it funnier", "Add a dragon friend", "Make it shorter"],
    code: ["Make stars worth double points", "Give an extra life every level", "Say something funny when I get hit"],
  };
  const ask = async (text: string) => {
    if (!text.trim() && !(p.type === "code" && runError)) return;
    setBusy(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = { request: text.trim() || "Help me fix this error" };
      if (p.type === "code" && runError) body.error = `${runError.line ? `Line ${runError.line}: ` : ""}${runError.message}`;
      const r = await api.post<ChangeResult>(`/kid/projects/${p.id}/ai-change`, body);
      setResult(r);
      if (r.understood) {
        setRequest("");
        if (r.project) onReplace(r.project);
        setRunId((n) => n + 1);
        await onDone(r.rewards ?? null);
      }
    } catch (e) {
      setResult({ understood: false, explanation: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <H3>🤖 {p.type === "code" ? "Ask AI about my code" : "Tell AI what to change"}</H3>
        <TextInput style={s.input} value={request} onChangeText={setRequest} placeholder={examples[p.type][0]} placeholderTextColor={C.ink3} onSubmitEditing={() => ask(request)} accessibilityLabel="Change request" />
        <Row>{examples[p.type].map((e) => <Chip key={e} tone="gray" label={e} onPress={() => ask(e)} />)}</Row>
        <Row>
          <Button title={busy ? "Working…" : "Go"} disabled={busy || request.trim().length < 2} onPress={() => ask(request)} />
          {p.type === "code" && runError ? <Button variant="sun" title="🐛 Help me with this error" disabled={busy} onPress={() => ask("")} /> : null}
        </Row>
        {result && !result.understood ? <Note>🤔 {result.explanation}</Note> : null}
        {result?.understood ? (
          <Card tint="mint">
            <Text style={{ fontWeight: "900" }}>✅ {result.summary}</Text>
            <P>{result.explanation}</P>
            <Row>
              {result.concept ? <Chip tone="sky" label={`💡 ${result.concept}`} /> : null}
              <Chip tone="gray" label={`Saved as version ${p.version}`} />
            </Row>
          </Card>
        ) : null}
        {result?.newBugs?.map((c) =>
          c.bug ? (
            <BugCard
              key={c.id}
              bug={c.bug}
              onTry={() => onFocus(focusSection(c.bug!.where))}
              onFix={async () => {
                const r = await api.post<{ rewards: Rewards; project: Project }>(`/kid/projects/${p.id}/fix`, { bugId: c.bug!.id });
                setResult({ ...result, newBugs: result.newBugs?.filter((b) => b.id !== c.id) });
                onReplace(r.project);
                await onDone(r.rewards);
              }}
            />
          ) : null,
        )}
      </Card>
      {(p.type === "game" || p.type === "app") && d.permissions.aiAgents ? <AgentPanel p={p} onDone={onDone} onReplace={onReplace} /> : null}
      {p.type === "code" ? (
        <>
          <CodeEditor spec={p.spec as CodeSpec} saving={saving} errorLine={runError?.line} onSave={async (x) => { await onSave(x); setRunId((n) => n + 1); }} />
          <H3>▶ Run</H3>
          <CodeView
            spec={p.spec as CodeSpec}
            runId={runId}
            onRan={(ok, e) => {
              setRunError(ok ? null : e ?? null);
              api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/ran`, { ok, error: e?.message ?? "" }).then((r) => showRewards(r.rewards)).catch(() => {});
            }}
          />
          {runError ? <Card style={{ borderColor: C.coral, borderWidth: 2 }}><Text style={{ fontWeight: "900", color: "#b3261e" }}>🐛 {runError.line ? `Line ${runError.line}: ` : ""}{runError.message}</Text><Muted>Bugs are normal! Check spelling and brackets, or ask AI for a hint.</Muted></Card> : null}
        </>
      ) : null}
      {p.type === "game" ? <GameEditor spec={p.spec as GameSpec} onSave={onSave} focus={focus} saving={saving} /> : null}
      {p.type === "app" ? <AppEditor spec={p.spec as AppSpec} onSave={onSave} focus={focus} saving={saving} allowAiGuide={d.permissions.aiGuideInApps} /> : null}
      {p.type === "image" ? <SceneEditor spec={p.spec as SceneSpec} onSave={onSave} saving={saving} /> : null}
      {p.type === "story" ? <StoryEditor spec={p.spec as StorySpec} onSave={onSave} saving={saving} /> : null}
    </View>
  );
}

export function TestTab({ p, onDone, onTry }: { p: Project; onDone: Done; onTry: (where: string) => void }) {
  const showRewards = useRewards();
  const [checks, setChecks] = useState<GameCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await api.post<{ checks: GameCheck[]; rewards: Rewards }>(`/kid/projects/${p.id}/test`);
    setChecks(r.checks);
    showRewards(r.rewards);
    setBusy(false);
  };
  const failing = checks?.filter((c) => !c.passed) ?? [];
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <H3>✅ Test my {p.type}</H3>
        <Muted>Tests ask simple questions about your {p.type}. Engineers run tests after every change.</Muted>
        <Button size="lg" title={busy ? "Testing…" : checks ? "↻ Run tests again" : "▶ Run tests"} disabled={busy} onPress={run} />
      </Card>
      {checks ? (
        <Card>
          {checks.map((c) => (
            <View key={c.id} style={{ backgroundColor: c.passed ? C.mintSoft : C.coralSoft, borderRadius: 12, padding: 10 }}>
              <Text style={{ fontWeight: "800" }}>{c.passed ? "✅" : "❌"} {c.question}</Text>
            </View>
          ))}
          <Text style={{ fontWeight: "900" }}>{failing.length ? `${failing.length} problem${failing.length > 1 ? "s" : ""} found.` : "🎉 All tests pass!"}</Text>
        </Card>
      ) : null}
      {failing.map((c) =>
        c.bug ? (
          <BugCard
            key={c.id + p.version}
            bug={c.bug}
            onTry={() => onTry(c.bug!.where)}
            onFix={async () => {
              const r = await api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/fix`, { bugId: c.bug!.id });
              await onDone(r.rewards);
              await run();
            }}
          />
        ) : null,
      )}
    </View>
  );
}

export function ExplainTab({ d, onDone }: { d: Detail; onDone: Done }) {
  const p = d.project;
  const { me } = useSession();
  const young = (me?.child?.age ?? 10) <= 8;
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<{ understood: boolean; feedback: string } | null>(null);
  const [learned, setLearned] = useState("");
  const [busy, setBusy] = useState(false);
  const by = (k: string) => d.journal.filter((j) => j.kind === k);
  const list = (items: JournalEntry[], empty: string) => (items.length ? items.map((j, i) => <P key={i}>• {j.text}</P>) : <Muted>{empty}</Muted>);
  return (
    <View style={{ gap: 12 }}>
      <Card tint="violet"><H3>💭 My idea</H3><P>{by("idea")[0]?.text ?? p.idea}</P></Card>
      <Card><H3>🤖 AI helped me with</H3>{list(by("ai"), "Nothing yet.")}</Card>
      <Card><H3>✏️ I changed</H3>{list(by("changed"), "Nothing yet — try BUILD!")}</Card>
      <Card><H3>🐛 Problems I solved</H3>{list(by("solved"), "No bugs fixed yet. Try TEST!")}</Card>
      <Card>
        <H3>💡 I learned</H3>
        {d.concepts.map((c) =>
          CONCEPTS[c] ? (
            <View key={c} style={{ backgroundColor: C.bg, borderRadius: 12, padding: 10 }}>
              <Text style={{ fontWeight: "900" }}>{CONCEPTS[c].emoji} {c}</Text>
              <Muted>{young ? CONCEPTS[c].young : CONCEPTS[c].older}</Muted>
            </View>
          ) : null,
        )}
        {list(by("learned"), "")}
        <TextInput style={s.input} value={learned} onChangeText={setLearned} placeholder="Something I learned…" placeholderTextColor={C.ink3} />
        <Button size="sm" title="Add" disabled={learned.trim().length < 2} onPress={async () => { await api.post(`/kid/projects/${p.id}/journal`, { kind: "learned", text: learned }); setLearned(""); onDone(null); }} />
      </Card>
      {p.type === "game" || p.type === "app" || p.type === "code" ? (
        <Card>
          <H3>🧠 Explain it in your own words</H3>
          <Muted>How does your {p.type} work? Real engineers explain their code to others.</Muted>
          <TextInput style={[s.input, { minHeight: 90, textAlignVertical: "top" }]} multiline value={text} onChangeText={setText} placeholder="When the rover touches a crystal, the score…" placeholderTextColor={C.ink3} />
          <Button title={busy ? "Reading…" : "Check my explanation"} disabled={busy || text.trim().length < 3} onPress={async () => {
            setBusy(true);
            try {
              const r = await api.post<{ understood: boolean; feedback: string; rewards: Rewards }>(`/kid/projects/${p.id}/explain`, { text });
              setFeedback(r);
              await onDone(r.rewards);
            } catch (e) {
              setFeedback({ understood: false, feedback: errorText(e) });
            } finally {
              setBusy(false);
            }
          }} />
          {feedback ? (feedback.understood ? <Card tint="mint"><P>{feedback.feedback}</P></Card> : <Note>{feedback.feedback}</Note>) : null}
        </Card>
      ) : null}
    </View>
  );
}

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function CodeTab({ p, canEject }: { p: Project; canEject: boolean }) {
  const showRewards = useRewards();
  const logged = useRef(false);
  if (!logged.current) {
    logged.current = true;
    api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/code-viewed`).then((r) => showRewards(r.rewards)).catch(() => {});
  }
  const code = p.type === "game" ? gameCode(p.spec as GameSpec) : appCode(p.spec as AppSpec);
  return (
    <View style={{ gap: 12 }}>
      <Card tint="sky">
        <H3>{"</>"} My Code</H3>
        <P>This is your {p.type} written as code. Every line matches something you can change in BUILD.</P>
      </Card>
      <View style={{ backgroundColor: "#16142a", borderRadius: 16, padding: 14 }}>
        <Text selectable style={{ color: "#e8e4ff", fontFamily: mono, fontSize: 12, lineHeight: 19 }}>{code}</Text>
      </View>
      {p.type === "game" && canEject ? (
        <Card tint="violet">
          <H3>⌨️ Ready for real code?</H3>
          <Muted>Turn this game into JavaScript you can change line by line. Your game stays as it is — you get a new code project.</Muted>
          <Button title="Open in Code Mode →" onPress={async () => {
            const r = await api.post<{ project: Project; rewards: Rewards }>(`/kid/projects/${p.id}/eject`);
            showRewards(r.rewards);
            router.push({ pathname: "/kid/project/[id]", params: { id: r.project.id, tab: "build" } });
          }} />
        </Card>
      ) : null}
    </View>
  );
}

interface FriendsData { enabled: boolean; friends: { id: string; name: string; avatar: string }[]; presets: string[] }

export function ShareTab({ d, onDone }: { d: Detail; onDone: Done }) {
  const p = d.project;
  const perms = d.permissions;
  const { data: friends } = useLoad(() => api.get<FriendsData>("/kid/friends"));
  const { data: contacts } = useLoad(() => api.get<{ id: string; name: string }[]>("/kid/contacts"));
  const [remix, setRemix] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("Look what I made!");
  const link = (x: Detail["shares"][number]) => `${serverUrl()}${x.slug ? `/p/${x.slug}` : `/s/${x.token}`}`;
  const active = d.shares.find((x) => x.status === "active");
  const share = async (audience: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post<{ pending: boolean; rewards: Rewards | null }>(`/kid/projects/${p.id}/share`, { audience, allowRemix: remix });
      setMsg(r.pending ? "📨 Sent to a grown-up for approval. Your link will work once they say yes!" : "🎉 Your link is ready!");
      await onDone(r.rewards);
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const options = [
    { audience: "family", emoji: "👪", title: "Family", ok: perms.projectSharing },
    { audience: "friends", emoji: "🧑‍🤝‍🧑", title: "Friends", ok: perms.friendSharing },
    { audience: "public", emoji: "🌍", title: "Publish", ok: perms.publicPublishing },
  ];
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <H3>👋 Look what I made!</H3>
        <Muted>Share pages show your first name only (if your grown-up allows it) — never where you live or go to school.</Muted>
        <Row>
          {options.map((o) => (
            <Button key={o.audience} variant={o.ok ? "primary" : "ghost"} disabled={!o.ok || busy} title={`${o.emoji} ${o.title}${o.ok ? "" : " 🔒"}`} onPress={() => share(o.audience)} />
          ))}
        </Row>
        {perms.friendRemix ? <Chip tone="gray" selected={remix} label="🔄 Let friends remix it" onPress={() => setRemix(!remix)} /> : null}
        {msg ? <Note>{msg}</Note> : null}
      </Card>
      {d.shares.map((x) => (
        <Card key={x.token}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "900" }}>{x.audience === "public" ? "🌍 Public" : x.audience === "friends" ? "🧑‍🤝‍🧑 Friends" : "👪 Family"}</Text>
            <Chip tone={x.status === "active" ? "mint" : "sun"} label={x.status === "active" ? "Live" : "Waiting for approval"} />
          </Row>
          {x.status === "active" ? (
            <Row>
              <Button size="sm" title="📤 Share" onPress={() => Share.share({ message: `Look what I made with SparkForge: ${p.title} ${link(x)}` })} />
              <Button size="sm" variant="ghost" title="Copy link" onPress={async () => { await Clipboard.setStringAsync(link(x)); setMsg("📋 Link copied!"); }} />
            </Row>
          ) : null}
          <Muted>👀 {x.views} views · ▶ {x.plays} plays · {timeAgo(x.createdAt)}</Muted>
        </Card>
      ))}
      {perms.friends && perms.friendSharing && friends?.enabled ? (
        <Card>
          <H3>📬 Send to a friend</H3>
          {friends.friends.length === 0 ? (
            <Muted>No SparkForge friends yet. A grown-up can connect you with a friend code.</Muted>
          ) : (
            <>
              <Row>{["Look what I made!", ...friends.presets].map((x) => <Chip key={x} tone="gray" selected={note === x} label={x} onPress={() => setNote(x)} />)}</Row>
              <Row>
                {friends.friends.map((f) => (
                  <Button key={f.id} variant="ghost" title={`${f.avatar} ${f.name}`} onPress={async () => {
                    try {
                      const r = await api.post<{ pending: boolean; to: string; rewards: Rewards | null }>(`/kid/projects/${p.id}/send-friend`, { friendId: f.id, note });
                      setMsg(r.pending ? `📨 Waiting for a grown-up to approve, then ${r.to} will get it.` : `📬 Sent to ${r.to}!`);
                      await onDone(r.rewards);
                    } catch (e) {
                      setMsg(errorText(e));
                    }
                  }} />
                ))}
              </Row>
            </>
          )}
        </Card>
      ) : null}
      {perms.emailSharing && active && contacts?.length ? (
        <Card>
          <H3>✉️ Send it to…</H3>
          <Row>
            {contacts.map((c) => (
              <Button key={c.id} variant="ghost" title={`Share with ${c.name}`} onPress={async () => {
                try {
                  const r = await api.post<{ status: string }>(`/kid/projects/${p.id}/email`, { contactId: c.id, token: active.token });
                  setMsg(r.status === "sent" ? `📬 Sent to ${c.name}!` : `📬 Saved for ${c.name} — a grown-up will pass it on.`);
                } catch (e) {
                  setMsg(errorText(e));
                }
              }} />
            ))}
          </Row>
        </Card>
      ) : null}
      {d.reactions.length ? (
        <Card>
          <H3>💬 What friends said</H3>
          <Row>{d.reactions.map((r) => <Chip key={r.kind + r.value} tone={r.kind === "emoji" ? "sun" : "sky"} label={`${r.value}${r.n > 1 ? ` ×${r.n}` : ""}`} />)}</Row>
        </Card>
      ) : null}
      {(p.type === "game" || p.type === "app" || p.type === "code") && perms.github ? (
        <Card>
          <H3>🐙 GitHub</H3>
          {!d.githubReady ? (
            <Muted>Ask a grown-up to connect GitHub in the parent area.</Muted>
          ) : (
            <>
              <Muted>Real engineers keep code in a repository. Each save is a commit.{perms.publicPublishing ? " Then it's deployed to the web with GitHub Pages." : ""}</Muted>
              <Button title={busy ? "Working…" : d.deployment ? `🔄 Update to version ${p.version}` : "🐙 Save to GitHub"} disabled={busy} onPress={async () => {
                setBusy(true);
                try {
                  const r = await api.post<{ commit: string; rewards: Rewards }>(`/kid/projects/${p.id}/deploy`);
                  setMsg(`✅ Committed: ${r.commit}`);
                  await onDone(r.rewards);
                } catch (e) {
                  setMsg(errorText(e));
                } finally {
                  setBusy(false);
                }
              }} />
              {d.deployment ? (
                <Row>
                  <Button size="sm" variant="ghost" title="📁 Repository" onPress={() => Linking.openURL(d.deployment!.repoUrl)} />
                  {d.deployment.pagesUrl ? <Button size="sm" variant="ghost" title="🌍 Live site" onPress={() => Linking.openURL(d.deployment!.pagesUrl!)} /> : null}
                </Row>
              ) : null}
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

export function TeamTab({ d, onDone }: { d: Detail; onDone: Done }) {
  const p = d.project;
  const owner = d.role === "owner";
  const { me } = useSession();
  const { data: friends } = useLoad(() => api.get<FriendsData>("/kid/friends"));
  const [role, setRole] = useState("Character Designer");
  const [task, setTask] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const call = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      const r = (await fn()) as { rewards?: Rewards | null } | undefined;
      await onDone(r?.rewards ?? null);
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const team = [{ id: p.childId, name: owner ? "Me" : d.owner ?? "Owner", avatar: "👑", role: "Owner" }, ...d.collaborators];
  const nameOf = (id: string | null) => (id === "ai" ? "🤖 AI" : id ? team.find((t) => t.id === id)?.name ?? "?" : "Anyone");
  const invitable = (friends?.friends ?? []).filter((f) => !d.collaborators.some((c) => c.id === f.id));
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <H3>👥 Team</H3>
        <Muted>Build together! Every change is saved with the name of who made it.</Muted>
        {team.map((t) => (
          <Row key={t.id} style={{ justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "800" }}>{t.avatar} {t.name} <Text style={{ color: C.ink3 }}>· {t.role}</Text></Text>
            {t.role !== "Owner" && (owner || t.id === me?.child?.id) ? <Button size="sm" variant="danger" title={owner ? "Remove" : "Leave"} onPress={() => call(() => api.del(`/kid/projects/${p.id}/collaborators/${t.id}`))} /> : null}
          </Row>
        ))}
        {owner && d.permissions.collaboration ? (
          invitable.length ? (
            <>
              <TextInput style={s.input} value={role} onChangeText={setRole} placeholder="Their job, e.g. Level Designer" placeholderTextColor={C.ink3} />
              <Row>{invitable.map((f) => <Button key={f.id} size="sm" title={`🤝 Invite ${f.name}`} onPress={() => call(() => api.post(`/kid/projects/${p.id}/collaborators`, { friendId: f.id, role }))} />)}</Row>
            </>
          ) : (
            <Muted>{friends?.friends.length ? "All your friends are on the team!" : "Add friends (with a grown-up's friend code) to build together."}</Muted>
          )
        ) : null}
      </Card>
      <Card>
        <H3>📝 Tasks</H3>
        {d.tasks.map((t) => (
          <Row key={t.id} wrap={false} style={{ justifyContent: "space-between" }}>
            <Chip tone="gray" selected={t.done} label={t.done ? "✓" : "○"} onPress={() => call(() => api.patch(`/kid/projects/${p.id}/tasks/${t.id}`, { done: !t.done }))} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", textDecorationLine: t.done ? "line-through" : "none" }}>{t.text}</Text>
              <Muted>{nameOf(t.assignee)}</Muted>
            </View>
            <Button size="sm" variant="danger" title="✕" onPress={() => call(() => api.del(`/kid/projects/${p.id}/tasks/${t.id}`))} />
          </Row>
        ))}
        <TextInput style={s.input} value={task} onChangeText={setTask} placeholder="Design the aliens" placeholderTextColor={C.ink3} />
        <Row>
          <Chip tone="gray" selected={assignee === null} label="Anyone" onPress={() => setAssignee(null)} />
          {team.map((t) => <Chip key={t.id} tone="gray" selected={assignee === t.id} label={`${t.avatar} ${t.name}`} onPress={() => setAssignee(t.id)} />)}
          <Chip tone="gray" selected={assignee === "ai"} label="🤖 AI" onPress={() => setAssignee("ai")} />
        </Row>
        <Button size="sm" title="+ Add task" disabled={task.trim().length < 2} onPress={() => { call(() => api.post(`/kid/projects/${p.id}/tasks`, { text: task, assignee })); setTask(""); }} />
        {err ? <Note>{err}</Note> : null}
      </Card>
    </View>
  );
}

export function HistoryTab({ d, onDone }: { d: Detail; onDone: Done }) {
  const p = d.project;
  const [preview, setPreview] = useState<{ version: number; spec: Project["spec"] } | null>(null);
  const authors = { ai: "🤖 AI", child: "🧒 Me", fix: "🐛 Fix" };
  return (
    <View style={{ gap: 12 }}>
      <Card tint="sky"><P>🕰️ Every change is saved as a version. Engineers call this version control — so you can experiment without fear!</P></Card>
      {preview ? (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <H3>Version {preview.version}</H3>
            <Button size="sm" variant="ghost" title="Close" onPress={() => setPreview(null)} />
          </Row>
          <Viewer p={{ ...p, spec: preview.spec, version: preview.version }} />
        </Card>
      ) : null}
      <Card>
        {d.versions.map((v) => (
          <View key={v.version} style={{ borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 10, gap: 6 }}>
            <Text style={{ fontWeight: "800" }}>v{v.version} · {v.summary}</Text>
            <Muted>{authors[v.author]}{v.byName && d.collaborators.length ? ` (${v.byName})` : ""} · {timeAgo(v.createdAt)}</Muted>
            <Row>
              <Button size="sm" variant="ghost" title="👀 Look" onPress={async () => setPreview({ version: v.version, spec: (await api.get<{ spec: Project["spec"] }>(`/kid/projects/${p.id}/versions/${v.version}`)).spec })} />
              {v.version !== p.version ? (
                <Button size="sm" title="↩ Go back" onPress={async () => {
                  const r = await api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/restore`, { version: v.version });
                  await onDone(r.rewards);
                }} />
              ) : null}
            </Row>
          </View>
        ))}
      </Card>
      {d.role === "owner" ? (
        <Button variant="danger" title="🗑️ Delete this project" onPress={() => {
          const doDelete = async () => {
            await api.del(`/kid/projects/${p.id}`);
            router.replace("/kid/mine");
          };
          if (Platform.OS === "web") {
            if (globalThis.confirm?.(`Delete “${p.title}”? This can't be undone.`)) doDelete();
          }
          else Alert.alert("Delete project?", `Delete “${p.title}”? This can't be undone.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: doDelete }]);
        }} />
      ) : null}
    </View>
  );
}
