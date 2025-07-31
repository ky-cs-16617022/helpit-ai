let currentPage = 0;
let questions = [];
let userAnswers = [];
let groupedQuestions = [];
let directionsMap = {};
let passageMap = {};
let groupOrder = ["1-4","5-7","8-10","11-14","15","16-17","18-20"];
let username = "";
let userphone = "";

document.getElementById("start-btn").onclick = function() {
  username = document.getElementById("username").value.trim();
  userphone = document.getElementById("userphone").value.trim();
  if (!username || !userphone) {
    alert("이름과 연락처를 입력해주세요.");
    return;
  }
  // 인트로/폼 hide, 문제페이지 show
  const introBanner = document.getElementById("intro-banner");
  if (introBanner) introBanner.style.display = "none";
  document.getElementById("user-form").style.display = "none";
  document.getElementById("main-content").style.display = "";
  startTimer();
  loadQuestions();
};

async function loadQuestions() {
  const response = await fetch("/api/questions");
  const data = await response.json();

  directionsMap = data.directions;
  passageMap = data.passages;
  questions = data.questions;

  // 그룹 정렬(순서 고정)
  const groups = {};
  questions.forEach((q) => {
    if (!groups[q.group]) groups[q.group] = [];
    groups[q.group].push(q);
  });

  groupedQuestions = groupOrder.map(group => ({
    group,
    questions: (groups[group] || []).sort((a,b)=>a.number-b.number)
  }));

  showPage(currentPage);
}

function showPage(page) {
  const container = document.getElementById("questions");
  container.innerHTML = "";

  const group = groupedQuestions[page];
  if (!group) return;

  const groupName = group.group;
  const groupQuestions = group.questions;

  // Directions
  if (directionsMap[groupName]) {
    const directionsDiv = document.createElement("div");
    directionsDiv.className = "directions-block";
    directionsDiv.innerHTML = `<strong>Directions:</strong> ${directionsMap[groupName]}`;
    container.appendChild(directionsDiv);
  }

  // 영어 passage 구현
  let passageText = null;
  if (
      passageMap[groupName] &&
      typeof passageMap[groupName] === "object" &&
      passageMap[groupName].passage
    ) {
    passageText = passageMap[groupName].passage;
  }
  if (!passageText && groupQuestions.length > 0) {
    for (const q of groupQuestions) {
      if (q.passage) {
        passageText = q.passage;
        break;
      }
    }
  }
  if (passageText) {
    const passageDiv = document.createElement("div");
    passageDiv.className = "passage-block";
    passageDiv.innerHTML = passageText;
    container.appendChild(passageDiv);
  }

  groupQuestions.forEach((q) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = "question";
    const questionNumber = q.number;
    const options = q.options;
    const savedAnswer = userAnswers[questionNumber - 1] || "";

    const questionText = `<strong>Q${questionNumber}.</strong> ${q.question}`;
    const optionButtons = options
      .map(
        (opt) => `
        <label>
          <input type="radio" name="q${questionNumber}" value="${opt}" ${
          savedAnswer === opt ? "checked" : ""
        }>
          ${opt}
        </label>`
      )
      .join("");

    questionDiv.innerHTML = `${questionText}<div class="options">${optionButtons}</div>`;
    container.appendChild(questionDiv);
  });

  // 네비게이션 버튼
  const navButtons = document.getElementById("nav-buttons");
  navButtons.innerHTML = "";

  if (page > 0) {
    const prev = document.createElement("button");
    prev.textContent = "이전";
    prev.className = "button";
    prev.onclick = () => {
      saveAnswers();
      currentPage--;
      showPage(currentPage);
    };
    navButtons.appendChild(prev);
  }

  if (page < groupedQuestions.length - 1) {
    const next = document.createElement("button");
    next.textContent = "다음";
    next.className = "button";
    next.onclick = () => {
      saveAnswers();
      currentPage++;
      showPage(currentPage);
    };
    navButtons.appendChild(next);
  }
}

function saveAnswers() {
  groupedQuestions[currentPage].questions.forEach((q) => {
    const selected = document.querySelector(`input[name="q${q.number}"]:checked`);
    userAnswers[q.number - 1] = selected ? selected.value : "";
  });
}

// 성적표 (파트별 정답수/득점)
function makePartScoreTable(results, part_scores) {
  const parts = ["어휘", "문법", "논리", "독해"];
  const partData = {};
  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalScore = 0;
  parts.forEach(part => { partData[part] = { correct: 0, total: 0 }; });
  results.forEach(q => {
    if(parts.includes(q["part"])) {
      partData[q["part"]].total++;
      if(q["정답 여부"]==="O") partData[q["part"]].correct++;
    }
    totalQuestions++;
    if(q["정답 여부"]==="O") totalCorrect++;
  });
  parts.forEach(part => { totalScore += part_scores[part] || 0; });

  // 폰트 조절!
  return `
    <table class="score-table" style="font-size:14.3px;">
      <tr>
        <th>구분</th>
        <th>어휘</th>
        <th>문법</th>
        <th>논리</th>
        <th>독해</th>
        <th>전체</th>
      </tr>
      <tr>
        <td>정답 수/문항 수</td>
        <td>${partData["어휘"].correct}/${partData["어휘"].total}</td>
        <td>${partData["문법"].correct}/${partData["문법"].total}</td>
        <td>${partData["논리"].correct}/${partData["논리"].total}</td>
        <td>${partData["독해"].correct}/${partData["독해"].total}</td>
        <td>${totalCorrect}/${totalQuestions}</td>
      </tr>
      <tr>
        <td>득점</td>
        <td>${part_scores["어휘"] || 0}</td>
        <td>${part_scores["문법"] || 0}</td>
        <td>${part_scores["논리"] || 0}</td>
        <td>${part_scores["독해"] || 0}</td>
        <td>${totalScore}</td>
      </tr>
    </table>
  `;
}

function makeResultTable(results) {
  // 폰트 작게!
  let html = `<h3 class="result-section-title">문항별 성적 분석</h3>`;
  function oneRow(keys, arr, renderer) {
    return `<tr>
      <td class="row-label">${keys}</td>` +
      arr.map(renderer).join("") +
    `</tr>`;
  }
  for (let gi=0; gi<2; gi++) {
    let start = gi*10, arr = results.slice(start, start+10);
    html += `<table class="score-table" style="font-size:13.8px;">
      <tr><th class="row-label">문항번호</th>` + arr.map((_,j)=>`<th>${start+j+1}</th>`).join("") + "</tr>"
    + oneRow("채점", arr, r => `<td>${r["정답 여부"]||""}</td>`)
    + oneRow("영역", arr, r => `<td>${r["part"]||""}</td>`)
    + oneRow("정답률(%)", arr, r => `<td>${r["정답률"]||""}</td>`)
    + "</table>";
  }
  return html;
}

// 채점(제출) 시 항상 오버레이 ON, 결과 or 오류시 OFF, 버튼 숨김
function submitAnswers() {
  saveAnswers();
  document.getElementById("grading-overlay").style.display = "flex";

  const name = username;
  const phone = userphone;
  const answers = {};
  questions.forEach((q) => {
    answers[`q${q.number}`] = userAnswers[q.number - 1] || "";
  });

  fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, answers })
  })
    .then((res) => res.json())
    .then((data) => {
      // 1. 채점중 오버레이 off (채점 결과/에러 받을때만 꺼지게!)
      document.getElementById("grading-overlay").style.display = "none";

      // 2. 결과 표(파트별 점수+문항별) 먼저
      const resultBox = document.getElementById("result-box");
      resultBox.innerHTML = makePartScoreTable(data.results, data.part_scores);
      resultBox.innerHTML += makeResultTable(data.results);

      // 3. AI 분석 결과 및 상담예약 박스
      const counselingHTML = `
        <div style="background:#7989d9;
                    border-radius:14px;
                    padding:26px 10px 18px 10px;
                    margin:38px 0 10px 0;
                    text-align:center;
                    box-shadow:0px 2px 12px #c9d9ff77;">
          <div style="color:white; font-size:2.2rem; font-family:'Noto Sans KR',sans-serif; letter-spacing:1px; line-height:1.2; font-weight:300;">
            김영편입 대면&amp;비대면
          </div>
          <div style="margin-top:4px;
                      font-size:2.6rem;
                      font-family:'Gmarket Sans', 'Noto Sans KR',sans-serif;
                      font-weight:900;
                      color:#ffee57;
                      letter-spacing:2px;
                      line-height:1.1;">
            1:1 맞춤상담 예약
          </div>
          <a href="http://www.kimyoung.co.kr/acad/acad_counsel.asp" target="_blank"
             style="display:inline-block;margin-top:18px;padding:12px 36px;
                    background:#ffe64a;
                    color:#3b3b3b;
                    font-size:1.2rem;
                    font-weight:800;
                    border-radius:28px;
                    text-decoration:none;
                    box-shadow:0px 4px 15px #fffeb0bb;
                    transition: background 0.16s;">
            예약하러 가기 →
          </a>
        </div>
      `;

      if (data.ai_feedback) {
        let aidoc = data.ai_feedback;
        // 파트별 줄바꿈 보정
        aidoc = aidoc.replace(/(?!^) ?(\*\*어휘\*\*)/g, '<br><br>$1');
        aidoc = aidoc.replace(/(?!^) ?(\*\*문법\*\*)/g, '<br><br>$1');
        aidoc = aidoc.replace(/(?!^) ?(\*\*독해\*\*)/g, '<br><br>$1');
        aidoc = aidoc.replace(/(?!^) ?(\*\*논리\*\*)/g, '<br><br>$1');
        aidoc = aidoc.replace(/(더 체계적이고 빠른 약점 보완 및 실력 향상을 원한다면 김영편입의 전문가와 상담하세요[.\!])/, 
          '<br><br><span style="color:#4d54b7;font-weight:bold;">$1</span>');
        const fbDiv = document.createElement("div");
        // 분석 타이틀+본문
        fbDiv.innerHTML = `<div class="analysis-box">
            <div class="analysis-title"><span class="icon">📊</span> HELPit AI 분석 결과</div>
            <div class="main-ai-analysis">${aidoc}</div>
          </div>${counselingHTML}`;
        resultBox.appendChild(fbDiv);
      }

      // 4. UI 숨김, 버튼 숨김(제출 후 항상!), 제목 변경, 타이머 중지
      document.getElementById("questions").style.display = "none";
      document.getElementById("nav-buttons").style.display = "none";
      document.querySelectorAll(".submit-button").forEach(btn => btn.style.display = "none");
      document.getElementById("timer").style.display = "none";
      document.querySelector("h1").textContent = "성적확인 및 AI 분석 결과";
      if (timerInterval) clearInterval(timerInterval);
    })
    .catch((err) => {
      document.getElementById("grading-overlay").style.display = "none";
      alert("서버에서 에러가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    });
}

// 타이머 (디자인 적용)
let timerInterval;
let remainingSeconds = 30 * 60;
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      alert("시간이 초과되었습니다. 자동 제출됩니다.");
      submitAnswers();
    }
  }, 1000);
}
function updateTimerDisplay() {
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  document.getElementById("timer").innerHTML = `<span style="font-weight:600; color:#138263; font-size: 18px;">남은 시간: ${minutes}:${seconds}</span>`;
}