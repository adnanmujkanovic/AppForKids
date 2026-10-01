import { useState } from "react";
import { Text } from "react-native";
import type { StorySpec } from "../../../shared/creations";
import { Button, Card, H2, Muted, Note, P, Row } from "./ui";

export function StoryView({ story }: { story: StorySpec }) {
  const [page, setPage] = useState(0);
  const p = story.pages[page];
  return (
    <Card>
      <H2 style={{ textAlign: "center" }}>{story.title}</H2>
      {p ? (
        <>
          <Text style={{ fontSize: 64, textAlign: "center" }}>{p.emoji}</Text>
          <P style={{ fontSize: 18, lineHeight: 28 }}>{p.text}</P>
        </>
      ) : (
        <Muted>This story has no pages yet.</Muted>
      )}
      {page === story.pages.length - 1 && story.moral ? <Note>✨ {story.moral}</Note> : null}
      <Row style={{ justifyContent: "space-between" }}>
        <Button size="sm" variant="ghost" title="← Back" disabled={page === 0} onPress={() => setPage(page - 1)} />
        <Muted>Page {Math.min(page + 1, story.pages.length)} of {story.pages.length}</Muted>
        <Button size="sm" title="Next →" disabled={page >= story.pages.length - 1} onPress={() => setPage(page + 1)} />
      </Row>
    </Card>
  );
}
