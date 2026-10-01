// Ported from AdminDashboardScreen.svelte's {#snippet surveyQuestionsEditor(...)}
// — used for both a 'survey' content item's own questions and an optional
// post-video quiz on a 'lesson' item (same {question, answers[]} shape).
import { View, Text, TextInput, Pressable } from "react-native";
import { Plus, X } from "lucide-react-native";
import type { SurveyQuestion } from "@/lib/adminApi";

export default function SurveyQuestionsEditor({
  questions,
  onChange,
  heading = "Questions & answer options",
}: {
  questions: SurveyQuestion[];
  onChange: (questions: SurveyQuestion[]) => void;
  heading?: string;
}) {
  function updateQuestion(qi: number, text: string) {
    onChange(questions.map((q, i) => (i === qi ? { ...q, question: text } : q)));
  }
  function removeQuestion(qi: number) {
    if (questions.length <= 1) return;
    onChange(questions.filter((_, i) => i !== qi));
  }
  function addQuestion() {
    onChange([...questions, { question: "", answers: ["", ""] }]);
  }
  function updateAnswer(qi: number, ai: number, text: string) {
    onChange(questions.map((q, i) => (i === qi ? { ...q, answers: q.answers.map((a, j) => (j === ai ? text : a)) } : q)));
  }
  function removeAnswer(qi: number, ai: number) {
    const q = questions[qi];
    if (q.answers.length <= 1) return;
    onChange(questions.map((q2, i) => (i === qi ? { ...q2, answers: q2.answers.filter((_, j) => j !== ai) } : q2)));
  }
  function addAnswer(qi: number) {
    onChange(questions.map((q, i) => (i === qi ? { ...q, answers: [...q.answers, ""] } : q)));
  }

  return (
    <View>
      <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
        {heading}
      </Text>
      <View style={{ gap: 10 }}>
        {questions.map((q, qi) => (
          <View key={qi} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <View className="flex-row items-center gap-2 mb-2">
              <TextInput
                value={q.question}
                onChangeText={(t) => updateQuestion(qi, t)}
                placeholder={`Question ${qi + 1}`}
                placeholderTextColor="#4A6842"
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#E8D4B0" }}
              />
              <Pressable
                onPress={() => removeQuestion(qi)}
                disabled={questions.length <= 1}
                className="items-center justify-center rounded-full"
                style={{ width: 28, height: 28, backgroundColor: "rgba(184,80,56,0.2)", opacity: questions.length <= 1 ? 0.4 : 1 }}
              >
                <X size={12} color="#E08A6A" />
              </Pressable>
            </View>
            <View style={{ gap: 6, paddingLeft: 4 }}>
              {q.answers.map((a, ai) => (
                <View key={ai} className="flex-row items-center gap-2">
                  <TextInput
                    value={a}
                    onChangeText={(t) => updateAnswer(qi, ai, t)}
                    placeholder={`Answer option ${ai + 1}`}
                    placeholderTextColor="#4A6842"
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#C4DAC0" }}
                  />
                  <Pressable onPress={() => removeAnswer(qi, ai)} disabled={q.answers.length <= 1} style={{ width: 20, height: 20, opacity: q.answers.length <= 1 ? 0.3 : 1 }} className="items-center justify-center rounded-full">
                    <X size={10} color="#96B496" />
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => addAnswer(qi)} className="self-start px-2.5 py-1 rounded-full mt-0.5" style={{ backgroundColor: "rgba(196,92,56,0.15)" }}>
                <Text className="text-[10px] font-sans-semibold" style={{ color: "#C45C38" }}>
                  + Add answer option
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable onPress={addQuestion} className="py-2 rounded-xl flex-row items-center justify-center gap-1.5" style={{ backgroundColor: "rgba(196,92,56,0.15)" }}>
          <Plus size={13} color="#C45C38" />
          <Text className="text-xs font-sans-semibold" style={{ color: "#C45C38" }}>
            Add question
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
