from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import json, openai, os

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

def flatten_questions(qs):
    flat = []
    for q in qs:
        if "number" in q:
            flat.append(q)
        elif "questions" in q:
            for subq in q["questions"]:
                subq["group"] = q["group"]
                flat.append(subq)
    return flat

with open("questions.json", encoding="utf-8") as f:
    questions_data = json.load(f)
directions = questions_data["directions"]
passages = questions_data["passages"]
questions = flatten_questions(questions_data["questions"])

def get_ai_feedback(score, part_scores, results):
    easy_wrong = [r for r in results if r["정답 여부"] == "X" and r.get("정답률", 0) >= 80]
    hard_right = [r for r in results if r["정답 여부"] == "O" and r.get("정답률", 0) <= 40]
    accs = [r.get("정답률", 0) for r in results if r.get("정답률", None) is not None]
    ox_line = ', '.join([f'q{r["번호"]}:{r["정답 여부"]}' for r in results])
    avg_acc = round(sum(accs)/len(accs), 1) if accs else 0

    if score >= 78:
        level = "파이널"
    elif score >= 65:
        level = "실전"
    elif score >= 50:
        level = "심화"
    else:
        level = "기초/기본"

    level_guide = """
[기초/기본]
- **어휘**: 기출 어휘 암기를 시작점으로, 기본 원리까지 이해해두세요.
- **문법**: 단순 암기가 아닌 원리 파악, 오개념 반복 체크.
- **독해**: 구문 분석 및 단어-문장-단락 흐름 정복.
- **논리**: 방향성, 논리 흐름 감 잡기. 다양한 유형 문제 접해볼 것.

[심화]
- **어휘**: 고난도/숙어 위주 반복, 직접 어휘장·오답장 활용.
- **문법**: 유형별/빈출 문제 반복, 혼동포인트 따로 정리.
- **독해**: 주제·목적·세부 내용 파악 연습, 속독스크랩.
- **논리**: 논리관계/키워드/근거 찾기 집중.

[실전]
- **어휘**: 기출·고난도, 동의어/반의어 실전 위주 마무리.
- **문법**: 실수 반복 방지, 오답노트 적극 활용.
- **독해**: 배경지식·시사 포함 지문 폭넓게, 시간 안배 연습.
- **논리**: 실제 논리 출제방식, 유형별 전략 정립.

[파이널]
- **어휘**: 대학별 기출·모의·최종 복습-암기, 약점 빠른 보완.
- **문법**: 1년 정리 총괄 리뷰, 오개념 제거.
- **독해**: 약점 유형/문제풀이 시간단축법 집중.
- **논리**: 장문, 더블블랭크 연습 및 실전 감각 마무리.
"""

    prompt = f"""
아래는 수험생 진단 결과입니다.

- 총점: {score}점 (100점 만점)
- 어휘 점수: {part_scores.get("어휘", 0)}점
- 문법 점수: {part_scores.get("문법", 0)}점
- 독해 점수: {part_scores.get("독해", 0)}점
- 전체 평균 정답률: {avg_acc}%
- 각 문항별 OX: {ox_line}
- 쉬운 문제(정답률 80%+)에서 틀린 문항: {len(easy_wrong)}개 ({','.join(str(r['번호']) for r in easy_wrong)})
- 어려운 문제(정답률 40%-)에서 맞힌 문항: {len(hard_right)}개 ({','.join(str(r['번호']) for r in hard_right)})

총평은 전체적인 경향·강약점·공부법 조언을 중심으로 2~3문단으로 요약하고,
거기에 이어서 각 영역명(**어휘**, **문법**, **독해**, **논리**)마다 굵은별표와 함께 반드시 **새 문단(줄바꿈/블록)으로 분리**해서 피드백 하세요.

{level_guide}

- 실전 코치답게 부족 영역·실책·편입영어 실전/시간관리/오답노트 팁 위주로 구체 조언
- 광고, 미사여구, 막연한 말X (공식적 존댓말/문어체 필수)
- '단계안내' 문구, 커리큘럼 분류, 첨삭·입시·모의고사 등은 절대 언급 금지!

마지막 한 줄,
'더 체계적이고 빠른 약점 보완 및 실력 향상을 원한다면 김영편입의 전문가와 상담하세요.'
(파트별 코멘트 내에는 '김영편입', 입시·첨삭·모의 등 언급 금지)
"""

    openai.api_key = "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"
    try:
        completion = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "너는 대한민국 입시 영어 전문가이자 코치야."},
                {"role": "user", "content": prompt}
            ]
        )
        feedback_text = completion.choices[0].message.content
    except Exception as e:
        feedback_text = f"[OpenAI 오류] {str(e)}"
    return feedback_text

@app.route("/api/submit", methods=["POST"])
def submit():
    data = request.get_json()
    name = data.get("name")
    phone = data.get("phone")
    answers = data.get("answers")

    results = []
    score = 0
    part_scores = { "어휘":0, "문법":0, "논리":0, "독해":0 }
    ox_arr = []

    for q in questions:
        qnum = f"q{q['number']}"
        user_answer = answers.get(qnum, "")
        correct = user_answer == q["answer"]
        ox = "O" if correct else "X"
        if correct:
            score += 5
            part_scores[q.get("part","기타")] = part_scores.get(q.get("part","기타"),0) + 5
        # 유형(type), 난이도(grade) 제거! part, 정답률만
        results.append({
            "번호": q["number"],
            "정답 여부": ox,
            "part": q.get("part", ""),
            "정답률": q.get("accuracy", None)
        })
        ox_arr.append(ox)

    ai_feedback = get_ai_feedback(score, part_scores, results)

    with open("results.csv", "a", encoding="utf-8") as f:
        ox_line = ",".join(ox_arr)
        f.write(f"{name},{phone},{score},{ox_line},\"{ai_feedback.strip()}\"\n")

    return jsonify({
        "score": score,
        "results": results,
        "part_scores": part_scores,
        "ai_feedback": ai_feedback
    })

@app.route("/api/questions")
def get_questions():
    return jsonify({
        "directions": directions,
        "passages": passages,
        "questions": questions
    })

@app.route("/")
def serve_index():
    return send_from_directory("templates", "index.html")

@app.route("/admin/download")
def download_results():
    file_path = "results.csv"
    if not os.path.exists(file_path):
        return "결과 파일이 존재하지 않습니다.", 404
    return send_file(
        file_path,
        as_attachment=True,
        download_name="HELPit_결과.csv",
        mimetype="text/csv"
    )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)