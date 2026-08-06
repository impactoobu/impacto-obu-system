import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =========================================================
   CONFIGURAÇÃO DO FIREBASE
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAmJ_fu33l0mcnezipFXAai3paGZLM5TFM",
  authDomain: "impacto-obu-system.firebaseapp.com",
  projectId: "impacto-obu-system",
  storageBucket: "impacto-obu-system.firebasestorage.app",
  messagingSenderId: "213609724304",
  appId: "1:213609724304:web:e68f7883294bd6cffedb15"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const academyId = "impacto-obu";

/* =========================================================
   ESTADO DO SISTEMA
========================================================= */

const state = {
  students: [],
  attendance: [],
  scanner: null,
  unsubscribeStudents: null,
  unsubscribeAttendance: null
};

const $ = (id) => document.getElementById(id);

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function toast(message, duration = 4000) {
  const element = $("toast");

  if (!element) {
    alert(message);
    return;
  }

  element.textContent = message;
  element.hidden = false;

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.hidden = true;
  }, duration);
}

function showFirebaseError(error, action = "realizar esta operação") {
  console.error(error);

  const messages = {
    "auth/api-key-not-valid":
      "A chave do Firebase é inválida.",

    "auth/invalid-api-key":
      "A chave do Firebase é inválida.",

    "auth/email-already-in-use":
      "Este e-mail já está cadastrado. Use a opção Entrar.",

    "auth/invalid-email":
      "O endereço de e-mail informado é inválido.",

    "auth/weak-password":
      "A senha deve ter pelo menos 6 caracteres.",

    "auth/invalid-credential":
      "E-mail ou senha incorretos.",

    "auth/user-not-found":
      "Nenhuma conta foi encontrada com este e-mail.",

    "auth/wrong-password":
      "A senha informada está incorreta.",

    "auth/operation-not-allowed":
      "O login por e-mail e senha ainda não está ativado no Firebase.",

    "auth/unauthorized-domain":
      "Este domínio ainda não está autorizado no Firebase.",

    "auth/network-request-failed":
      "Não foi possível conectar ao Firebase. Verifique sua internet.",

    "permission-denied":
      "O Firestore bloqueou esta operação. Verifique as regras do banco."
  };

  const message =
    messages[error?.code] ||
    `Não foi possível ${action}.\n\n${error?.code || ""}\n${error?.message || ""}`;

  toast(message, 7000);
  alert(message);
}

function setButtonLoading(button, loading, normalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Aguarde..." : normalText;
}

function yen(value = 0) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function todayKey() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return characters[character];
  });
}

/* =========================================================
   LIMPEZA DO CACHE ANTIGO
========================================================= */

async function clearOldServiceWorker() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations =
        await navigator.serviceWorker.getRegistrations();

      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }
  } catch (error) {
    console.warn("Não foi possível limpar o cache antigo:", error);
  }
}

clearOldServiceWorker();

/* =========================================================
   PERFIL DO USUÁRIO
========================================================= */

async function createOrUpdateUserProfile(user) {
  const userReference = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userReference);

  const userData = {
    academyId,
    name: user.displayName || "Administrador",
    email: user.email,
    role: "admin",
    active: true,
    updatedAt: serverTimestamp()
  };

  if (!userSnapshot.exists()) {
    userData.createdAt = serverTimestamp();
  }

  await setDoc(userReference, userData, {
    merge: true
  });
}

/* =========================================================
   AUTENTICAÇÃO
========================================================= */

onAuthStateChanged(auth, async (user) => {
  const authView = $("auth");
  const appView = $("app");

  if (authView) {
    authView.hidden = Boolean(user);
  }

  if (appView) {
    appView.hidden = !user;
  }

  if (!user) {
    stopSubscriptions();
    return;
  }

  try {
    if ($("user")) {
      $("user").textContent =
        user.displayName || user.email || "Administrador";
    }

    await createOrUpdateUserProfile(user);
    subscribeToDatabase();
  } catch (error) {
    showFirebaseError(error, "carregar o perfil do administrador");
  }
});

/* Mostrar ou esconder formulário de cadastro */

if ($("showRegister")) {
  $("showRegister").addEventListener("click", () => {
    const registerForm = $("register");

    if (registerForm) {
      registerForm.hidden = !registerForm.hidden;
    }
  });
}

/* Login */

if ($("login")) {
  $("login").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("email")?.value.trim();
    const password = $("password")?.value;
    const button = event.submitter;

    if (!email || !password) {
      toast("Preencha o e-mail e a senha.");
      return;
    }

    setButtonLoading(button, true, "Entrar");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Login realizado com sucesso.");
    } catch (error) {
      showFirebaseError(error, "entrar no sistema");
    } finally {
      setButtonLoading(button, false, "Entrar");
    }
  });
}

/* Criar primeiro administrador */

if ($("register")) {
  $("register").addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = $("name")?.value.trim();
    const email = $("regEmail")?.value.trim();
    const password = $("regPassword")?.value;
    const button = event.submitter;

    if (!name || !email || !password) {
      toast("Preencha nome, e-mail e senha.");
      return;
    }

    if (password.length < 6) {
      toast("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setButtonLoading(button, true, "Criar conta");

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(credential.user, {
        displayName: name
      });

      await createOrUpdateUserProfile(credential.user);

      toast("Administrador criado com sucesso.");
    } catch (error) {
      showFirebaseError(error, "criar a conta");
    } finally {
      setButtonLoading(button, false, "Criar conta");
    }
  });
}

/* Recuperação de senha */

const forgotPasswordButton =
  $("forgotPassword") ||
  $("forgot") ||
  $("forgotButton");

if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener("click", async () => {
    const email =
      $("email")?.value.trim() ||
      $("regEmail")?.value.trim();

    if (!email) {
      toast("Digite seu e-mail no campo de login.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast("O e-mail de recuperação foi enviado.");
    } catch (error) {
      showFirebaseError(error, "enviar o e-mail de recuperação");
    }
  });
}

/* Sair */

if ($("logout")) {
  $("logout").addEventListener("click", async () => {
    try {
      await signOut(auth);
      toast("Você saiu do sistema.");
    } catch (error) {
      showFirebaseError(error, "sair do sistema");
    }
  });
}

/* =========================================================
   NAVEGAÇÃO
========================================================= */

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => {
    const pageId = button.dataset.page;

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.id === pageId);
    });

    document.querySelectorAll("nav button").forEach((navButton) => {
      navButton.classList.toggle("active", navButton === button);
    });
  });
});

/* =========================================================
   CADASTRO DE ALUNOS
========================================================= */

if ($("newStudent")) {
  $("newStudent").addEventListener("click", () => {
    $("studentDialog")?.showModal();
  });
}

if ($("closeDialog")) {
  $("closeDialog").addEventListener("click", () => {
    $("studentDialog")?.close();
  });
}

if ($("studentForm")) {
  $("studentForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = $("studentName")?.value.trim();
    const category = $("category")?.value;
    const belt = $("belt")?.value;
    const monthlyFee = Number($("fee")?.value || 0);
    const responsibleName = $("responsible")?.value.trim();
    const phone = $("phone")?.value.trim();

    if (!fullName) {
      toast("Digite o nome do aluno.");
      return;
    }

    if (!auth.currentUser) {
      toast("Você precisa estar conectado.");
      return;
    }

    const registrationNumber =
      `OBU-${Date.now().toString().slice(-7)}`;

    try {
      await addDoc(collection(db, "students"), {
        academyId,
        registrationNumber,
        fullName,
        category,
        belt,
        monthlyFee,
        dueDay: 10,
        responsibleName,
        phone,
        active: true,
        paidCurrentMonth: false,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });

      $("studentDialog")?.close();
      $("studentForm").reset();

      if ($("fee")) {
        $("fee").value = 8800;
      }

      toast(`Aluno cadastrado. Código: ${registrationNumber}`);
    } catch (error) {
      showFirebaseError(error, "salvar o aluno");
    }
  });
}

/* =========================================================
   FIRESTORE EM TEMPO REAL
========================================================= */

function stopSubscriptions() {
  if (state.unsubscribeStudents) {
    state.unsubscribeStudents();
    state.unsubscribeStudents = null;
  }

  if (state.unsubscribeAttendance) {
    state.unsubscribeAttendance();
    state.unsubscribeAttendance = null;
  }
}

function subscribeToDatabase() {
  stopSubscriptions();

  const studentsQuery = query(
    collection(db, "students"),
    where("academyId", "==", academyId)
  );

  state.unsubscribeStudents = onSnapshot(
    studentsQuery,
    (snapshot) => {
      state.students = snapshot.docs
        .map((studentDocument) => ({
          id: studentDocument.id,
          ...studentDocument.data()
        }))
        .sort((firstStudent, secondStudent) =>
          (firstStudent.fullName || "").localeCompare(
            secondStudent.fullName || ""
          )
        );

      render();
    },
    (error) => {
      showFirebaseError(error, "carregar os alunos");
    }
  );

  const attendanceQuery = query(
    collection(db, "attendance"),
    where("academyId", "==", academyId),
    where("dateKey", "==", todayKey())
  );

  state.unsubscribeAttendance = onSnapshot(
    attendanceQuery,
    (snapshot) => {
      state.attendance = snapshot.docs.map(
        (attendanceDocument) => ({
          id: attendanceDocument.id,
          ...attendanceDocument.data()
        })
      );

      render();
    },
    (error) => {
      showFirebaseError(error, "carregar as presenças");
    }
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function render() {
  const activeStudents = state.students.filter(
    (student) => student.active !== false
  );

  const received = activeStudents
    .filter((student) => student.paidCurrentMonth)
    .reduce(
      (total, student) =>
        total + Number(student.monthlyFee || 0),
      0
    );

  const pending = activeStudents
    .filter((student) => !student.paidCurrentMonth)
    .reduce(
      (total, student) =>
        total + Number(student.monthlyFee || 0),
      0
    );

  if ($("mStudents")) {
    $("mStudents").textContent = activeStudents.length;
  }

  if ($("mAttendance")) {
    $("mAttendance").textContent = state.attendance.length;
  }

  if ($("mReceived")) {
    $("mReceived").textContent = yen(received);
  }

  if ($("mPending")) {
    $("mPending").textContent = yen(pending);
  }

  renderStudents();
  renderFinance();
  renderAttendance();
}

/* =========================================================
   LISTA DE ALUNOS
========================================================= */

function renderStudents() {
  if (!$("studentList")) return;

  const searchTerm =
    $("search")?.value.trim().toLowerCase() || "";

  const filteredStudents = state.students.filter((student) => {
    const searchableText = [
      student.fullName,
      student.responsibleName,
      student.phone,
      student.registrationNumber
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchTerm);
  });

  if (!filteredStudents.length) {
    $("studentList").innerHTML =
      "<p>Nenhum aluno encontrado.</p>";
    return;
  }

  $("studentList").innerHTML = filteredStudents
    .map((student) => {
      const paymentClass =
        student.paidCurrentMonth ? "paid" : "pending";

      const paymentText =
        student.paidCurrentMonth ? "Pago" : "Pendente";

      return `
        <article class="row">
          <div>
            <b>${escapeHtml(student.fullName)}</b>

            <small>
              ${escapeHtml(student.category || "")}
              •
              ${escapeHtml(student.belt || "")}
              <br>
              Código: ${escapeHtml(
                student.registrationNumber || ""
              )}
            </small>
          </div>

          <span class="badge ${paymentClass}">
            ${paymentText}
          </span>
        </article>
      `;
    })
    .join("");
}

if ($("search")) {
  $("search").addEventListener("input", renderStudents);
}

/* =========================================================
   FINANCEIRO
========================================================= */

function renderFinance() {
  if (!$("financeList")) return;

  if (!state.students.length) {
    $("financeList").innerHTML =
      "<p>Nenhum aluno cadastrado.</p>";
    return;
  }

  $("financeList").innerHTML = state.students
    .map((student) => {
      const paymentClass =
        student.paidCurrentMonth ? "paid" : "pending";

      const paymentText =
        student.paidCurrentMonth ? "Pago" : "Marcar pago";

      return `
        <article class="row">
          <div>
            <b>${escapeHtml(student.fullName)}</b>

            <small>
              ${yen(student.monthlyFee)}
              • vencimento dia ${student.dueDay || 10}
            </small>
          </div>

          <button
            type="button"
            class="badge ${paymentClass}"
            data-payment-id="${student.id}"
          >
            ${paymentText}
          </button>
        </article>
      `;
    })
    .join("");

  document
    .querySelectorAll("[data-payment-id]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const student = state.students.find(
          (item) => item.id === button.dataset.paymentId
        );

        if (!student) return;

        try {
          await updateDoc(
            doc(db, "students", student.id),
            {
              paidCurrentMonth:
                !student.paidCurrentMonth,

              paymentUpdatedAt:
                serverTimestamp(),

              paymentUpdatedBy:
                auth.currentUser?.uid || null
            }
          );

          toast(
            student.paidCurrentMonth
              ? "Pagamento marcado como pendente."
              : "Pagamento registrado com sucesso."
          );
        } catch (error) {
          showFirebaseError(
            error,
            "atualizar o pagamento"
          );
        }
      });
    });
}

/* =========================================================
   PRESENÇA
========================================================= */

function renderAttendance() {
  if (!$("attendanceList")) return;

  if (!state.attendance.length) {
    $("attendanceList").innerHTML =
      "<p>Nenhuma presença registrada hoje.</p>";
    return;
  }

  $("attendanceList").innerHTML = state.attendance
    .map(
      (attendance) => `
        <article class="row">
          <div>
            <b>${escapeHtml(attendance.studentName)}</b>

            <small>
              Método:
              ${escapeHtml(
                attendance.method === "qr"
                  ? "QR Code"
                  : "Manual"
              )}
            </small>
          </div>

          <span class="badge paid">
            Presente
          </span>
        </article>
      `
    )
    .join("");
}

async function checkin(code, method = "qr") {
  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase();

  if (!normalizedCode) {
    toast("Digite ou escaneie o código do aluno.");
    return;
  }

  const student = state.students.find(
    (item) =>
      String(item.registrationNumber || "")
        .toUpperCase() === normalizedCode
  );

  if (!student) {
    toast("Código do aluno não encontrado.");
    return;
  }

  const alreadyPresent = state.attendance.some(
    (attendance) => attendance.studentId === student.id
  );

  if (alreadyPresent) {
    toast(`${student.fullName} já está presente.`);
    return;
  }

  try {
    await addDoc(collection(db, "attendance"), {
      academyId,
      studentId: student.id,
      studentName: student.fullName,
      registrationNumber: student.registrationNumber,
      dateKey: todayKey(),
      method,
      checkedInAt: serverTimestamp(),
      registeredBy: auth.currentUser?.uid || null
    });

    toast(`Presença registrada: ${student.fullName}`);
  } catch (error) {
    showFirebaseError(error, "registrar a presença");
  }
}

/* Presença manual */

if ($("manualBtn")) {
  $("manualBtn").addEventListener("click", async () => {
    const code = $("manualCode")?.value;

    await checkin(code, "manual");

    if ($("manualCode")) {
      $("manualCode").value = "";
    }
  });
}

/* Iniciar câmera para QR Code */

if ($("startScan")) {
  $("startScan").addEventListener("click", async () => {
    if (typeof Html5Qrcode === "undefined") {
      toast("A biblioteca do leitor de QR Code não foi carregada.");
      return;
    }

    try {
      state.s
