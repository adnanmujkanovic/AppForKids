import { Chat } from "../../components/Chat";
import { useLoad } from "../../lib/useLoad";
import { loadHome } from "../../lib/kid";
import { Card, Loading, Muted, P } from "../../components/ui";

export default function Learn() {
  const { data } = useLoad(loadHome);
  if (!data) return <Loading />;
  const p = data.child.permissions;
  const desc = {
    teach: "🔵 Teach mode: I'll explain and give you similar examples, but you'll find the answers yourself.",
    hints: "🟡 Hint mode: I'll give hints and check your work.",
    answers: "🟢 Answers allowed — I'll always show how to get there. Say “don't give me the answer” any time.",
  }[p.homeworkMode];
  return (
    <Chat
      thread="learn"
      placeholder="Type your homework question, like 24 x 3"
      allowImage={p.photoUpload}
      empty={
        <Card tint="sky">
          <P>{desc}</P>
          <Muted>What are you working on today?{p.photoUpload ? " You can also add a photo of your worksheet 📷" : ""}</Muted>
        </Card>
      }
    />
  );
}
