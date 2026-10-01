// Ported from frontend/src/lib/components/CommunityPoll.svelte.
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart3, CheckCircle2 } from "lucide-react-native";
import { castCommunityPollVote } from "@/lib/api";
import { getClientMac } from "@/lib/device";

export type PollPost = {
  id: number | string;
  title: string;
  body?: string | null;
  metadata?: { options?: string[] };
  poll_results?: { optionIndex: number; votes: number }[];
};

const DEFAULT_THEME = { bg: "#0b1e13", bgAlt: "#0a1b11", border: "#12301e", accent: "#c29d53", accentSoft: "rgba(194,157,83,0.18)" };

export default function CommunityPoll({
  post,
  theme = DEFAULT_THEME,
  castVote = castCommunityPollVote,
}: {
  post: PollPost;
  theme?: typeof DEFAULT_THEME;
  castVote?: (id: number | string, mac: string, index: number) => Promise<any>;
}) {
  const isDemo = typeof post.id === "string" && post.id.startsWith("demo-");
  const options = post.metadata?.options ?? [];
  const [results, setResults] = useState(post.poll_results ?? []);
  const [voted, setVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [justVotedIndex, setJustVotedIndex] = useState<number | null>(null);
  const storageKey = `communityPollVoted_${post.id}`;

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored != null) setVoted(true);
      } catch {
        // storage unavailable — falls back to always showing the voting UI, safe: the backend constraint is the real double-vote guard
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tally = useMemo(() => {
    const byIndex = new Map(results.map((r) => [r.optionIndex, r.votes]));
    const total = results.reduce((sum, r) => sum + r.votes, 0);
    return options.map((label, i) => {
      const votes = byIndex.get(i) ?? 0;
      return { label, votes, pct: total > 0 ? Math.round((votes / total) * 100) : 0 };
    });
  }, [options, results]);
  const totalVotes = tally.reduce((sum, t) => sum + t.votes, 0);

  async function vote(index: number) {
    if (voting || voted) return;
    setVoting(true);
    setJustVotedIndex(index);

    if (isDemo) {
      const next = results.map((r) => ({ ...r }));
      const existing = next.find((r) => r.optionIndex === index);
      if (existing) existing.votes += 1;
      else next.push({ optionIndex: index, votes: 1 });
      setResults(next);
      setVoted(true);
      setVoting(false);
      AsyncStorage.setItem(storageKey, String(index)).catch(() => {});
      return;
    }

    const mac = getClientMac();
    if (!mac) {
      setVoting(false);
      return;
    }
    const result = await castVote(post.id, mac, index);
    setVoting(false);
    if (result.ok && result.data?.results) {
      setResults(result.data.results);
      setVoted(true);
      AsyncStorage.setItem(storageKey, String(index)).catch(() => {});
    }
  }

  if (options.length < 2) return null;

  return (
    <View className="rounded-2xl p-4" style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border }}>
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: theme.accentSoft }}>
          <BarChart3 size={14} color={theme.accent} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[10px] font-sans-semibold uppercase tracking-wider" style={{ color: theme.accent }}>
            Quick Poll
          </Text>
          <Text className="text-sm font-sans-semibold" style={{ color: "#f3f4f6" }}>
            {post.title}
          </Text>
        </View>
      </View>
      {!!post.body && (
        <Text className="text-xs mb-3" style={{ color: "#9ca3af" }}>
          {post.body}
        </Text>
      )}

      <View style={{ gap: 8 }}>
        {tally.map((opt, i) =>
          voted ? (
            <View key={i} className="relative rounded-xl overflow-hidden" style={{ backgroundColor: theme.bgAlt }}>
              <View className="absolute inset-y-0 left-0" style={{ width: `${opt.pct}%`, backgroundColor: theme.accentSoft }} />
              <View className="relative flex-row items-center justify-between gap-2 px-3.5 py-2.5">
                <View className="flex-row items-center gap-1.5">
                  {justVotedIndex === i && <CheckCircle2 size={12} color={theme.accent} />}
                  <Text className="text-xs font-sans-semibold" style={{ color: "#e5e7eb" }}>
                    {opt.label}
                  </Text>
                </View>
                <Text className="text-xs font-sans-semibold" style={{ color: theme.accent }}>
                  {opt.pct}%
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              key={i}
              onPress={() => vote(i)}
              disabled={voting}
              className="rounded-xl px-3.5 py-2.5"
              style={{ backgroundColor: theme.bgAlt, borderWidth: 1, borderColor: theme.border, opacity: voting ? 0.6 : 1 }}
            >
              <Text className="text-xs font-sans-semibold" style={{ color: "#e5e7eb" }}>
                {opt.label}
              </Text>
            </Pressable>
          )
        )}
      </View>

      {voted && (
        <Text className="text-[10px] mt-2.5" style={{ color: "#6b7280" }}>
          {totalVotes} vote{totalVotes === 1 ? "" : "s"} · thanks for voting
        </Text>
      )}
    </View>
  );
}
