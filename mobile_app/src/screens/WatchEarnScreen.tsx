// Watch & Earn tab — replaces the former STUB (see this file's previous
// header comment, now obsolete). Ported from TimelineScreen.svelte's
// `{#if viewingItem} ... content viewer ... {:else} ... hero + 4 feed
// sections ... {/if}` branch (template lines ~1051-1360 and ~1730-1895).
// The shared header/bottom-bar/modals that used to wrap this in the source
// now live one level up — see TimelineHeader.tsx and WatchEarnOverlays.tsx.
import { View, Text, Image, Pressable, ScrollView, Linking, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Zap, CheckCircle2, FileText, Gift, ExternalLink, X, Play } from "lucide-react-native";
import TimelineHeader from "@/components/TimelineHeader";
import TLContentCard from "@/components/TLContentCard";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import YouTubePlayer from "@/components/YouTubePlayer";
import { TL_TYPE_ICON, TL_TYPE_LABEL, TL_TYPE_COLOR, type TLItem } from "@/lib/data";
import { useWatchEarn, isYouTubeUrl, getYouTubeVideoId, parseArticleBody, splitBold, type ArticleBlock } from "@/flow/WatchEarnContext";

type SectionKey = "whats_new" | "survey" | "news" | "watch_earn";
type SectionMeta = { title: string; items: TLItem[]; width: number; height: number };

function ArticleRuns({ text, style }: { text: string; style?: any }) {
  return (
    <Text style={style}>
      {splitBold(text).map((run, i) =>
        run.bold ? (
          <Text key={i} style={{ fontWeight: "700", color: "#E8D4B0" }}>
            {run.text}
          </Text>
        ) : (
          <Text key={i}>{run.text}</Text>
        )
      )}
    </Text>
  );
}

function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <View className="mb-6">
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <Text key={i} className="font-serif" style={{ fontSize: 18, fontWeight: "700", color: "#E8D4B0", marginTop: i === 0 ? 0 : 24, marginBottom: 10 }}>
              {block.text}
            </Text>
          );
        }
        if (block.type === "h3") {
          return (
            <Text key={i} style={{ fontSize: 13, fontWeight: "700", color: "#C4DAC0", textTransform: "uppercase", letterSpacing: 1, marginTop: 18, marginBottom: 8 }}>
              {block.text}
            </Text>
          );
        }
        if (block.type === "ul" || block.type === "ol") {
          return (
            <View key={i} style={{ marginBottom: 16 }}>
              {block.items.map((li, j) => (
                <View key={j} className="flex-row" style={{ marginBottom: 6 }}>
                  <Text style={{ color: "#C45C38", fontSize: 13, width: 18 }}>{block.type === "ol" ? `${j + 1}.` : "•"}</Text>
                  <ArticleRuns text={li} style={{ flex: 1, fontSize: 13, lineHeight: 20, color: "#C4DAC0" }} />
                </View>
              ))}
            </View>
          );
        }
        if (block.type === "citation") {
          return (
            <View key={i} style={{ marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ fontSize: 11, fontStyle: "italic", color: "#96B496", lineHeight: 16 }}>
                <Text style={{ fontStyle: "normal", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Source — </Text>
                {block.text}
              </Text>
            </View>
          );
        }
        return (
          <ArticleRuns
            key={i}
            text={block.text}
            style={{ fontSize: 13, lineHeight: 26, color: "#C4DAC0", marginBottom: 14 }}
          />
        );
      })}
    </View>
  );
}

function ContentViewer() {
  const w = useWatchEarn();
  const insets = useSafeAreaInsets();
  const item = w.viewingItem!;
  const ViewerIcon = TL_TYPE_ICON[item.type];
  const viewerTypeColor = TL_TYPE_COLOR[item.type];
  const isYT = !!w.playableVideoUrl && isYouTubeUrl(w.playableVideoUrl);
  const ytId = isYT ? getYouTubeVideoId(w.playableVideoUrl) : null;
  const articleIsExternalLink = /^https?:\/\//i.test(item.bodyUrl || "");
  const articleBlocks = item.type === "article" && item.bodyUrl && !articleIsExternalLink ? parseArticleBody(item.bodyUrl) : [];

  return (
    <View className="flex-1" style={{ backgroundColor: "#0E1F14" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View className="flex-row items-center gap-3 px-4 pb-4" style={{ paddingTop: insets.top + 12 }}>
          <Pressable onPress={w.dismissViewer} className="w-9 h-9 rounded-full items-center justify-center active:scale-90" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
            <ArrowLeft size={18} color="#E8D4B0" />
          </Pressable>
          <Text className="text-sm font-sans-semibold" style={{ color: "#C4DAC0" }}>{TL_TYPE_LABEL[item.type]}</Text>
        </View>

        <View className="mx-4 rounded-3xl overflow-hidden relative" style={{ height: 210, backgroundColor: "#000" }}>
          {w.playableVideoUrl ? (
            isYT && ytId ? (
              <YouTubePlayer videoId={ytId} onProgress={w.handleVideoTimeUpdate} />
            ) : (
              <NativeVideoPlayer uri={w.playableVideoUrl} onProgress={w.handleVideoTimeUpdate} />
            )
          ) : item.type === "video" ? (
            <>
              {!!item.img && <Image source={{ uri: item.img }} className="absolute inset-0 w-full h-full" resizeMode="cover" />}
              <LinearGradient colors={["rgba(14,31,20,0.9)", "rgba(14,31,20,0.15)", "transparent"]} locations={[0, 0.65, 1]} className="absolute inset-0" />
              <View className="absolute inset-0 items-center justify-center">
                <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: w.viewDone ? "#2E5A3E" : "rgba(196,92,56,0.88)" }}>
                  {w.viewDone ? <CheckCircle2 size={30} color="#E8D4B0" /> : <ViewerIcon size={26} color="#fff" />}
                </View>
              </View>
            </>
          ) : item.type === "survey" ? (
            <>
              {item.img ? (
                <>
                  <Image source={{ uri: item.img }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
                  <View className="absolute inset-0" style={{ backgroundColor: "rgba(14,31,20,0.72)" }} />
                </>
              ) : (
                <View className="absolute inset-0" style={{ backgroundColor: "#1D3C2A" }} />
              )}
              <View className="absolute inset-0 items-center justify-center">
                <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: w.viewDone ? "#2E5A3E" : "rgba(196,92,56,0.28)" }}>
                  {w.viewDone ? <CheckCircle2 size={30} color="#E8D4B0" /> : <FileText size={26} color="#C45C38" />}
                </View>
              </View>
            </>
          ) : (
            <>
              {!!item.img && <Image source={{ uri: item.img }} className="absolute inset-0 w-full h-full" resizeMode="cover" />}
              <LinearGradient colors={["rgba(14,31,20,0.9)", "rgba(14,31,20,0.15)", "transparent"]} locations={[0, 0.65, 1]} className="absolute inset-0" />
              <View className="absolute inset-0 items-center justify-center">
                <View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: w.viewDone ? "#2E5A3E" : "rgba(196,92,56,0.28)" }}>
                  {w.viewDone ? <CheckCircle2 size={26} color="#E8D4B0" /> : <ViewerIcon size={22} color="#C45C38" />}
                </View>
              </View>
            </>
          )}
          <View className="absolute top-3 right-3 flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "#C45C38" }}>
            <Zap size={11} color="#fff" />
            <Text className="text-[11px] font-bold text-white">{item.earnLabel} free</Text>
          </View>
        </View>

        <View className="px-4 mt-5">
          {item.type === "article" ? (
            <>
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-[10px] font-bold uppercase" style={{ color: "#C45C38", letterSpacing: 2 }}>{item.category || "Article"}</Text>
                <View className="w-1 h-1 rounded-full" style={{ backgroundColor: "#96B496" }} />
                <Text className="text-[11px]" style={{ color: "#96B496" }}>{item.duration}</Text>
              </View>
              <Text className="font-serif" style={{ fontSize: 24, lineHeight: 30, fontWeight: "700", color: "#E8D4B0", marginBottom: 12 }}>{item.title}</Text>
              <View className="rounded-full mb-5" style={{ width: 40, height: 3, backgroundColor: "#C45C38" }} />

              {articleIsExternalLink ? (
                <Pressable onPress={() => Linking.openURL(item.bodyUrl!)} className="flex-row items-center gap-1.5 mb-6">
                  <Text className="text-sm font-bold" style={{ color: "#C45C38" }}>Read the full article</Text>
                  <ExternalLink size={14} color="#C45C38" />
                </Pressable>
              ) : (
                <ArticleBody blocks={articleBlocks} />
              )}

              {!w.viewDone && (
                <Pressable
                  onPress={w.markArticleDone}
                  className="w-full py-3.5 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95 mb-1"
                  style={{ backgroundColor: "rgba(196,92,56,0.18)", borderWidth: 1, borderColor: "rgba(196,92,56,0.4)" }}
                >
                  <CheckCircle2 size={16} color="#C45C38" />
                  <Text className="font-bold text-sm" style={{ color: "#C45C38" }}>{"I've finished reading"}</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-2 mb-2">
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: viewerTypeColor }}>
                  <Text className="text-[10px] font-bold text-white">{item.category}</Text>
                </View>
                <Text className="text-[11px]" style={{ color: "#96B496" }}>{item.duration}</Text>
              </View>
              <Text className="font-serif" style={{ fontSize: 20, fontWeight: "700", color: "#E8D4B0", marginBottom: 16 }}>{item.title}</Text>

              {item.type === "lesson" && (item.surveyQuestions?.length ?? 0) > 0 && (
                <View className="flex-row items-center gap-1.5 mb-4">
                  <View className="px-2 py-0.5 rounded-full flex-row items-center gap-1" style={{ backgroundColor: w.lessonVideoDone ? "rgba(46,90,62,0.32)" : "rgba(196,92,56,0.28)" }}>
                    {w.lessonVideoDone && <CheckCircle2 size={10} color="#7EC88E" />}
                    <Text className="text-[9px] font-bold" style={{ color: w.lessonVideoDone ? "#7EC88E" : "#C45C38" }}>Watch</Text>
                  </View>
                  <View style={{ width: 12, height: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
                  <View
                    className="px-2 py-0.5 rounded-full flex-row items-center gap-1"
                    style={{ backgroundColor: w.viewDone ? "rgba(46,90,62,0.32)" : w.lessonVideoDone ? "rgba(196,92,56,0.28)" : "rgba(255,255,255,0.08)" }}
                  >
                    {w.viewDone && <CheckCircle2 size={10} color="#7EC88E" />}
                    <Text className="text-[9px] font-bold" style={{ color: w.viewDone ? "#7EC88E" : w.lessonVideoDone ? "#C45C38" : "#6B8A6B" }}>Quiz</Text>
                  </View>
                </View>
              )}

              {w.showingQuiz ? <QuizCarousel /> : <ProgressBar />}
            </>
          )}

          {!w.viewDone ? (
            !w.showingQuiz && item.type !== "article" && (
              <Text className="text-sm text-center" style={{ color: "#C4DAC0" }}>
                Complete this {TL_TYPE_LABEL[item.type].toLowerCase()} to earn <Text className="font-bold" style={{ color: "#C45C38" }}>{item.earnLabel} free internet</Text>
              </Text>
            )
          ) : (
            <View>
              <View className="rounded-3xl p-5 items-center mb-4" style={{ backgroundColor: "rgba(46,90,62,0.28)", borderWidth: 1, borderColor: "rgba(46,90,62,0.55)" }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
                <Text className="text-base font-bold mb-1" style={{ color: "#E8D4B0" }}>You earned it!</Text>
                <Text className="text-sm text-center" style={{ color: "#C4DAC0" }}>
                  <Text className="font-bold" style={{ color: "#C45C38" }}>{item.earnLabel} free internet</Text> added to your balance
                </Text>
              </View>
              <Pressable
                onPress={w.claimReward}
                className="w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95"
                style={{ backgroundColor: "#C45C38" }}
              >
                <Gift size={16} color="#fff" />
                <Text className="font-bold text-sm text-white">Claim {item.earnLabel} — Add to Balance</Text>
              </Pressable>
              {w.claimError && <Text className="text-xs text-center mt-2" style={{ color: "#E08A6A" }}>{"That didn't go through — please try again."}</Text>}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ProgressBar() {
  const w = useWatchEarn();
  return (
    <View className="mb-5">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs" style={{ color: "#96B496" }}>{w.viewDone ? "Complete!" : "Progress"}</Text>
        <Text className="text-xs font-bold" style={{ color: "#C45C38" }}>{Math.round(w.viewProgress)}%</Text>
      </View>
      <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
        <View className="h-full rounded-full" style={{ width: `${w.viewProgress}%`, backgroundColor: w.viewDone ? "#2E7D52" : "#C45C38" }} />
      </View>
    </View>
  );
}

function QuizCarousel() {
  const w = useWatchEarn();
  const questions = w.viewingItem?.surveyQuestions ?? [];
  const current = questions[w.surveyIndex];

  return (
    <View className="mb-5">
      <View className="flex-row items-center justify-center gap-1.5 mb-4">
        {questions.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => w.goToSurveyQuestion(i)}
            style={{
              width: i === w.surveyIndex ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: w.surveyAnswers[i] !== undefined ? "#C45C38" : i === w.surveyIndex ? "rgba(196,92,56,0.5)" : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </View>

      <View className="rounded-2xl p-5" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
        <Text className="text-[10px] font-bold uppercase mb-2" style={{ color: "#96B496", letterSpacing: 1 }}>
          Question {w.surveyIndex + 1} of {questions.length}
        </Text>
        <Text className="text-sm font-bold mb-4" style={{ color: "#E8D4B0" }}>{current?.question}</Text>
        <View className="flex-row flex-wrap gap-2">
          {(current?.answers ?? []).map((opt) => (
            <Pressable
              key={opt}
              onPress={() => w.answerSurveyQuestion(w.surveyIndex, opt)}
              className="py-2.5 px-3.5 rounded-xl active:scale-95"
              style={{ backgroundColor: w.surveyAnswers[w.surveyIndex] === opt ? "#C45C38" : "rgba(255,255,255,0.1)" }}
            >
              <Text className="text-[11px] font-bold" style={{ color: w.surveyAnswers[w.surveyIndex] === opt ? "#fff" : "#C4DAC0" }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <Pressable onPress={() => w.goToSurveyQuestion(w.surveyIndex - 1)} disabled={w.surveyIndex === 0} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Text className="text-[11px] font-bold" style={{ color: w.surveyIndex === 0 ? "#4A6842" : "#C4DAC0" }}>← Previous</Text>
        </Pressable>
        <Pressable
          onPress={() => w.goToSurveyQuestion(w.surveyIndex + 1)}
          disabled={w.surveyIndex >= questions.length - 1}
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <Text className="text-[11px] font-bold" style={{ color: w.surveyIndex >= questions.length - 1 ? "#4A6842" : "#C4DAC0" }}>Next →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HeroCard() {
  const w = useWatchEarn();
  const item = w.featured;
  const done = w.completedIds.has(item.id);
  return (
    <View className="px-4 pt-4 pb-6" style={{ backgroundColor: "#1D3C2A" }}>
      <Text className="font-serif" style={{ fontSize: 24, fontWeight: "700", color: "#E8D4B0", marginBottom: 4 }}>Welcome to Ungana!</Text>
      <Text className="text-sm mb-4" style={{ color: "#96B496" }}>Watch, learn & earn your internet access</Text>

      <Pressable onPress={() => w.startContent(item)} disabled={done} className="rounded-3xl overflow-hidden relative active:scale-[0.98]" style={{ height: 200, opacity: done ? 0.75 : 1 }}>
        {item.img ? (
          <Image source={{ uri: item.img }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        ) : (
          <View className="absolute inset-0" style={{ backgroundColor: "#1D3C2A" }} />
        )}
        <LinearGradient colors={["rgba(0,0,0,0.82)", "rgba(0,0,0,0.12)", "transparent"]} locations={[0, 0.65, 1]} className="absolute inset-0" />
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.85)" }}>
            <Play size={22} color="#fff" fill="#fff" />
          </View>
        </View>
        <View className="absolute top-3 right-3 flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "#C45C38" }}>
          <Zap size={11} color="#fff" />
          <Text className="text-[11px] font-bold text-white">{item.earnLabel} free</Text>
        </View>
        {done && (
          <View className="absolute top-3 left-3 flex-row items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: "#2E5A3E" }}>
            <CheckCircle2 size={10} color="#fff" />
          </View>
        )}
        <View className="absolute bottom-0 left-0 right-0 p-4">
          <Text className="text-[10px] font-bold uppercase mb-1" style={{ color: "#C45C38", letterSpacing: 1 }}>{item.category} · {item.duration}</Text>
          <Text className="text-base font-bold text-white">{item.title}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function FeedStrip({ title, sectionKey, items, width, height }: { title: string; sectionKey: SectionKey; items: TLItem[]; width: number; height: number }) {
  const w = useWatchEarn();
  if (items.length === 0) return null;
  return (
    <View className="pt-3 pb-2">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-sm font-bold" style={{ color: "#1D3C2A" }}>{title}</Text>
        <Pressable onPress={() => w.setExpandedSection(sectionKey)}>
          <Text className="text-[11px] font-bold" style={{ color: "#C45C38" }}>See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
        {items.map((item) => (
          <TLContentCard key={item.id} item={item} completedIds={w.completedIds} onStart={w.startContent} width={width} height={height} />
        ))}
      </ScrollView>
    </View>
  );
}

function ExpandedSectionModal({ sections }: { sections: Record<SectionKey, SectionMeta> }) {
  const w = useWatchEarn();
  const meta = w.expandedSection ? sections[w.expandedSection] : null;

  return (
    <Modal visible={!!meta} transparent animationType="fade" onRequestClose={() => w.setExpandedSection(null)}>
      <Pressable className="flex-1 items-center justify-center px-5" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onPress={() => w.setExpandedSection(null)}>
        <Pressable className="w-full rounded-3xl overflow-hidden" style={{ backgroundColor: "#E8D4B0", maxHeight: "85%" }} onPress={(e) => e.stopPropagation()}>
          {meta && (
            <>
              <View className="flex-row items-center justify-between px-5 pt-5 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: "rgba(29,60,42,0.1)" }}>
                <Text className="font-serif text-base font-bold" style={{ color: "#1D3C2A" }}>{meta.title}</Text>
                <Pressable onPress={() => w.setExpandedSection(null)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(29,60,42,0.08)" }}>
                  <X size={14} color="#1D3C2A" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                {meta.items.map((item) => (
                  <TLContentCard
                    key={item.id}
                    item={item}
                    completedIds={w.completedIds}
                    onStart={(i) => {
                      w.setExpandedSection(null);
                      w.startContent(i);
                    }}
                    width={meta.width}
                    height={meta.height}
                  />
                ))}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Feed({ onBack }: { onBack: () => void }) {
  const w = useWatchEarn();
  const insets = useSafeAreaInsets();
  const sections: Record<SectionKey, SectionMeta> = {
    whats_new: { title: "What's new around?", items: w.newItems, width: 132, height: 170 },
    survey: { title: "Quick surveys", items: w.surveys, width: 132, height: 170 },
    news: { title: "News & Stories", items: w.articles, width: 158, height: 128 },
    watch_earn: { title: "Watch & Earn", items: w.videos, width: 178, height: 128 },
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#0E1F14" }}>
      <TimelineHeader onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <HeroCard />
        <View style={{ backgroundColor: "#E8D4B0" }}>
          {(Object.entries(sections) as [SectionKey, SectionMeta][]).map(([key, meta]) => (
            <FeedStrip key={key} sectionKey={key} title={meta.title} items={meta.items} width={meta.width} height={meta.height} />
          ))}
        </View>
      </ScrollView>
      <ExpandedSectionModal sections={sections} />
    </View>
  );
}

export default function WatchEarnScreen({ onBack }: { onBack: () => void }) {
  const w = useWatchEarn();
  return w.viewingItem ? <ContentViewer /> : <Feed onBack={onBack} />;
}
