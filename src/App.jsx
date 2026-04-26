import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sunrise, Sunset, Search, Calendar, Moon, Sun, 
  Sparkles, ChevronRight, LogOut, Shuffle, Plus, X, 
  AlertCircle, Eye, EyeOff, CheckCircle, Download, Upload,
  Target, TrendingUp, Award, FileText, Book, Settings,
  Trash2, Edit, Save, XCircle, Flame, Zap, Shield, Star, Crown, 
  Bell, Check, Music, MessageSquare, Menu, Lock, ChevronDown, ChevronUp, 
  Mountain, Landmark, Swords, Bookmark, Library, MessageCircle, Camera
} from 'lucide-react';

import { auth, db, messaging } from './config/firebase-config'; 
import { getToken, deleteToken, onMessage } from 'firebase/messaging'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, setDoc, getDoc, collection, query, where,
  getDocs, updateDoc, deleteDoc, Timestamp, deleteField 
} from 'firebase/firestore';
import './App.css';
import AdBanner from './AdBanner'; 

// BANCO DE MEMÓRIA DOS BASTIÕES GDVE
const BASTIOES_DB = [
  { name: "Bastiões 1976 - 001 a 006", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23101&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
  { name: "Bastiões 1977 - 007 a 017", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23102&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
  { name: "Bastiões 1978 - 018 a 029", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23103&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
  { name: "Bastiões 1979 - 029 a 039", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23104&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" }
];

function App() {
  // Estados
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fvConfig, setFvConfig] = useState(null); // Armazena a estrutura vinda do Firebase
  const [isDownloadingConfig, setIsDownloadingConfig] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [notificationsActive, setNotificationsActive] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [morningTime, setMorningTime] = useState('06:00');
  const [eveningTime, setEveningTime] = useState('22:00');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [kuravaEnabled, setKuravaEnabled] = useState(true);
  const [isCloudDataLoaded, setIsCloudDataLoaded] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);

  const toggleNotifications = async () => {
    if (notificationsActive) {
      const confirmDisable = window.confirm('Deseja silenciar os lembretes do Diário Filosófico?');
      if (confirmDisable) {
        try {
          await deleteToken(messaging);
          if (user) {
            await updateDoc(doc(db, 'users', user.uid), { fcmToken: deleteField() });
          }
          setNotificationsActive(false);
          alert('🔕 Lembretes silenciados. Você não receberá mais os avisos de Prólogo e Epílogo.');
        } catch (error) {
          console.error('Erro ao silenciar:', error);
          alert('Houve um pequeno erro. Tente novamente.');
        }
      }
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { 
          vapidKey: 'BCbaqmBk9-neW0G2xxxszZk7nlj89NDaLdeLqkiW9-wUb2GW1JxnneFaTmFcLaYjQUE49mG1lAMnZNCqLp4ZXL0' 
        });
        if (token && user) {
           await updateDoc(doc(db, 'users', user.uid), { fcmToken: token });
           setNotificationsActive(true);
           alert('🔔 Lembretes ativados! Nós avisaremos você nos horários adequados.');
        }
      } else {
        alert('As notificações estão bloqueadas no seu navegador. Para receber lembretes, clique no ícone de "Cadeado" ao lado do endereço do site e mude para "Permitir".');
      }
    } catch (error) {
      console.error('Erro ao ativar notificações:', error);
      alert('Seu dispositivo parece não suportar esse tipo de aviso no momento.');
    }
  };

  // Estados de Navegação e Fogo Interno
  const [view, setView] = useState('today');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const handleDateChange = async (newDate) => {
    if (!newDate) return;
    setSelectedDate(newDate);
    if (user) {
      await loadTodayEntry(user.uid, newDate);
    }
  };

  const [theme, setTheme] = useState('light');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState(null);
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [streak, setStreak] = useState(0); 
  const [longestStreak, setLongestStreak] = useState(0); 
  const [showStreakModal, setShowStreakModal] = useState(false); 

  // Streaks da FV
  const [fvDiaryStreak, setFvDiaryStreak] = useState(0);
  const [fvTasksStreak, setFvTasksStreak] = useState(0);

  // Controles do Menu Mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDiaryMenu, setShowDiaryMenu] = useState(false);
  const [showPracticesMenu, setShowPracticesMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850);

  // --- ESTADOS DO BALÃO DE CONSCIÊNCIA ---
  const [showConsciousnessModal, setShowConsciousnessModal] = useState(false);
  const [manualAltitudeModifier, setManualAltitudeModifier] = useState(0);
  const [pendingAltitudeModifier, setPendingAltitudeModifier] = useState(0);
  const [consumedActionIds, setConsumedActionIds] = useState([]);
  const [displayedActions, setDisplayedActions] = useState([]);
  const [animatingActionId, setAnimatingActionId] = useState(null);
  const [animatingType, setAnimatingType] = useState(null); // 'sim', 'oposto' ou 'pular'  

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 850);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sensor de Instalação (PWA)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  // Inatividade
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(15);

  // Sugestões e Melhorias
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');

  const handleSendEmail = () => {
    if (!suggestionText.trim()) return alert('Por favor, digite sua sugestão primeiro!');
    const subject = encodeURIComponent('Ideia/Melhoria - Diário Filosófico');
    const body = encodeURIComponent(`Olá!\n\nAqui está minha sugestão para o aplicativo:\n\n${suggestionText}`);
    window.open(`mailto:henrique.zanchi@gmail.com?subject=${subject}&body=${body}`); 
    setShowSuggestionModal(false);
    setSuggestionText('');
  };

  const handleSendWhatsApp = () => {
    if (!suggestionText.trim()) return alert('Por favor, digite sua sugestão primeiro!');
    const text = encodeURIComponent(`*Ideia/Melhoria - Diário Filosófico* 💡\n\n${suggestionText}`);
    window.open(`https://wa.me/5562991729783?text=${text}`, '_blank');
    setShowSuggestionModal(false);
    setSuggestionText('');
  };

  // Estados do Prólogo e Epílogo
  const [morningDone, setMorningDone] = useState(false);
  const [selectedVirtue, setSelectedVirtue] = useState('');
  const [isTodayVirtueExpanded, setIsTodayVirtueExpanded] = useState(false);
  const [customVirtue, setCustomVirtue] = useState('');
  const [showCustomVirtue, setShowCustomVirtue] = useState(false);
  const [dailyQuote, setDailyQuote] = useState(null);
  const [dailyIntention, setDailyIntention] = useState('');
  const [morningChallenges, setMorningChallenges] = useState(''); 
  const [morningVehicles, setMorningVehicles] = useState(''); 
  const [lastDrawDate, setLastDrawDate] = useState(null);
  const [eveningDone, setEveningDone] = useState(false);
  const [didMorning, setDidMorning] = useState(true); 
  const [whereIFailed, setWhereIFailed] = useState('');
  const [whatIDidWell, setWhatIDidWell] = useState('');
  const [whatILeftUndone, setWhatILeftUndone] = useState('');
  const [freeEpilogue, setFreeEpilogue] = useState('');

  // Tarefas e Metas
  const [customTasks, setCustomTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [todayTasksStatus, setTodayTasksStatus] = useState({});
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('daily');
  const [newTaskWeekDays, setNewTaskWeekDays] = useState([]); 
  const [newTaskMonthDay, setNewTaskMonthDay] = useState(1);
  const [newTaskBaseDate, setNewTaskBaseDate] = useState(''); 
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [virtueGoals, setVirtueGoals] = useState([]);
  const [projectGoals, setProjectGoals] = useState([]);
  const [newVirtueGoal, setNewVirtueGoal] = useState('');
  const [newProjectGoal, setNewProjectGoal] = useState('');
  const [acceptedMissions, setAcceptedMissions] = useState([]);
  const [missionToAccept, setMissionToAccept] = useState(null);
  const [showGoalsEditor, setShowGoalsEditor] = useState(false);
  const [selectedVirtueDetail, setSelectedVirtueDetail] = useState(null);
  const [entries, setEntries] = useState([]);

  // Estados FV
  const [fvUnlocked, setFvUnlocked] = useState(false);
  const [fvClickCount, setFvClickCount] = useState(0);
  const [fvLockClickCount, setFvLockClickCount] = useState(0);
  const [fvLastCartaDate, setFvLastCartaDate] = useState('');
  const [fvNextCartaDate, setFvNextCartaDate] = useState('');
  const [fvMasterName, setFvMasterName] = useState('');
  const [fvLastMeetingDate, setFvLastMeetingDate] = useState('');
  const [technicalSynthesis, setTechnicalSynthesis] = useState(null);
  const [discipularSynthesis, setDiscipularSynthesis] = useState(null);
  const [aiGuarda, setAiGuarda] = useState(null);
  const [aiConquistas, setAiConquistas] = useState(null);
  const [aiInvestigacoes, setAiInvestigacoes] = useState(null);
  const [fvAiMetricas, setFvAiMetricas] = useState(null);
  const [fvAiAuditoria, setFvAiAuditoria] = useState(null);
  const [fvAiLexical, setFvAiLexical] = useState(null);
  const [isGeneratingDiscSync, setIsGeneratingDiscSync] = useState(false);
  const [aiSuggestedGoals, setAiSuggestedGoals] = useState(null);
  const [isGeneratingGoals, setIsGeneratingGoals] = useState(false);
  const [kuravaData, setKuravaData] = useState(null);
  const [isGeneratingKurava, setIsGeneratingKurava] = useState(false);
  const [isKuravaRevealed, setIsKuravaRevealed] = useState(false);
  const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState(false);
  const [fvGdveDesafios, setFvGdveDesafios] = useState([]);
  const [fvGdveReuniao, setFvGdveReuniao] = useState('');
  const [fvGdveBastiaoName, setFvGdveBastiaoName] = useState(''); 
  const [fvGdveBastiaoLink, setFvGdveBastiaoLink] = useState(''); 
  const [showQuickFv, setShowQuickFv] = useState(false); 
  const [fvGdveTasks, setFvGdveTasks] = useState([]);
  const [newGdveTaskName, setNewGdveTaskName] = useState('');
  const [editingGdveTaskId, setEditingGdveTaskId] = useState(null);
  const [newGdveTaskTarget, setNewGdveTaskTarget] = useState(1);
  const [newGdveTaskIsCycle, setNewGdveTaskIsCycle] = useState(false);
  const [fvGdveCycleStatus, setFvGdveCycleStatus] = useState({});
  
  // --- ESTADOS DE LEITURA E ESTUDOS ---
  const [books, setBooks] = useState([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', author: '', currentPage: 0, totalPages: 0 });
  const [editingBookId, setEditingBookId] = useState(null);
  const [activeBookForAi, setActiveBookForAi] = useState(null);
  const [bookUserNote, setBookUserNote] = useState('');
  const [bookAiInsight, setBookAiInsight] = useState(null);
  const [isGeneratingBookAi, setIsGeneratingBookAi] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [bookRecommendation, setBookRecommendation] = useState(null);
  const [isScanningShelf, setIsScanningShelf] = useState(false);
  const [detectedBooks, setDetectedBooks] = useState([]);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const AMAZON_AFFILIATE_ID = 'filosofiae0a5-20'; // 👈 SUBSTITUA PELO SEU ID DE AFILIADO REAL
  const totalForgedPages = books.reduce((acc, book) => acc + (book.currentPage || 0), 0);

  // --- MOTOR DE MÉTRICAS (Fase 3) ---
  const getFavoriteTheme = () => {
    if (books.length === 0) return "Nenhum";
    const themeCounts = {};
    books.forEach(b => {
      const theme = b.category || 'Filosofia';
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });
    // Descobre o tema que mais se repete
    return Object.keys(themeCounts).reduce((a, b) => themeCounts[a] > themeCounts[b] ? a : b);
  };
  
  const favoriteTheme = getFavoriteTheme();
  const finishedBooksCount = books.filter(b => b.totalPages > 0 && b.currentPage >= b.totalPages).length;

// --- MOTOR DO CONVITE SOCRÁTICO PÓS-LEITURA ---
  const [postReadInvite, setPostReadInvite] = useState(null);
  const [inviteTopics, setInviteTopics] = useState(null);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);

  const generateTopicsForInvite = async (livro) => {
    if (!user) return;
    setIsGeneratingTopics(true);
    setInviteTopics(null);
    
    const prompt = `Atue como um Tutor Socrático. O aluno está lendo "${livro.title}" de ${livro.author}. Ele acabou de ler até a página ${livro.currentPage} de ${livro.totalPages} (aprox. ${Math.round((livro.currentPage/livro.totalPages)*100)}% da obra). 
    Sugira 3 tópicos, conceitos ou dúvidas muito breves (1 linha cada) que ele provavelmente encontrou APENAS nestas páginas lidas. 
    AVISO ESTREITO: NÃO DÊ SPOILERS do final do livro ou de eventos futuros. Baseie-se apenas no arco inicial/médio até esta página.
    Retorne ESTRITAMENTE um array JSON de strings. Exemplo: ["A atitude do personagem X", "O conceito de Y", "Uma frase que me marcou foi..."]`;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) 
      });
      const data = await response.json();
      setInviteTopics(JSON.parse(data.candidates[0].content.parts[0].text));
    } catch (e) {
      setInviteTopics(["Qual foi a principal ideia destas páginas?", "Teve alguma frase que chamou sua atenção?", "Ficou alguma dúvida sobre o texto?"]);
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  // --- MOTOR CENTRAL DO TUTOR SOCRÁTICO (COM RAIO-X) ---
  const runSocraticTutor = async (livro, note = '') => {
    console.log("Rastreador 1: Botão clicado. Iniciando função.");
    
    if(!aiConsent) {
      console.log("Rastreador Erro: Consentimento não dado.");
      return alert('Autorize a IA nas Configurações do Diário.');
    }

    console.log("Rastreador 2: Consentimento OK. Preparando Modal para o livro:", livro?.title);
    setActiveBookForAi(livro);
    setBookAiInsight(null);
    setIsGeneratingBookAi(true);

    const prompt = `Atue como um Tutor Socrático da filosofia clássica. O discípulo está lendo "${livro.title}" (de ${livro.author}) e está na página ${livro.currentPage}.
    ${note ? `Tópico escolhido pelo discípulo: "${note}". Faça uma reflexão sobre isso.` : `Faça uma breve reflexão profunda (2 a 3 linhas) sobre um tema ou conceito que ele provavelmente encontrou nestas páginas iniciais/médias.`}
    REGRA ANTI-SPOILER: Não revele o final nem eventos futuros do livro.
    Termine OBRIGATORIAMENTE com uma única pergunta reflexiva para ele pensar hoje.
    Formate em HTML (<b>, <br/>).`;

    console.log("Rastreador 3: Prompt montado. Enviando sinal para o Google...");

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      console.log("Rastreador 4: Google respondeu! Status:", response.status);
      const data = await response.json();
      setBookAiInsight(data.candidates[0].content.parts[0].text);
      console.log("Rastreador 5: Sucesso! Texto na tela.");
      
    } catch(e) {
      console.error("Rastreador ERRO FATAL no Fetch:", e);
      setBookAiInsight("O Oráculo está em silêncio. Retorne mais tarde.");
    } finally {
      setIsGeneratingBookAi(false);
    }
  };

  // O Motor de Ranks Literários
  const getReadingRank = (pages) => {
    if (pages < 500) return { title: "Pedra Bruta", next: 500, color: "#95A5A6" };
    if (pages < 1500) return { title: "Coluna Dórica", next: 1500, color: "#3498DB" };
    if (pages < 3000) return { title: "Cidadão de Roma", next: 3000, color: "#E67E22" };
    if (pages < 6000) return { title: "Senador Estóico", next: 6000, color: "#9B59B6" };
    if (pages < 10000) return { title: "Mestre da Academia", next: 10000, color: "#E74C3C" };
    return { title: "Sábio do Panteão", next: null, color: "#FFD700" };
  };
  
  // Estado Diário da Carta de Degrau FV
  const [fvDaily, setFvDaily] = useState({
    item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
    horasVoluntariado: '', horasAulaAssistida: '', horasAulaMinistrada: '', gdveTasksStatus: {}, gdveAttendance: false,    gdveTasksStatus: {}, gdveAttendance: false,
    praticas: {
      tratak: false, recitarHonra: false, recitar7Fases: false,
      camara: false, templo: false, porta: false, patioAberto: false,
      patioColunas: false, santuario: false
    }
  });

  // Controle Universal das Práticas Guiadas
  const [isPracticeActive, setIsPracticeActive] = useState(false); 
  const [activePracticeId, setActivePracticeId] = useState(null); 
  const [practicePhase, setPracticePhase] = useState('intro'); 
  const [cancelClickCount, setCancelClickCount] = useState(0); 
  const [tratakMouseActive, setTratakMouseActive] = useState(false);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  
  // ESTADO DO TEMPLO
  const [temploSelections, setTemploSelections] = useState({ porta: false, patioAberto: false, patioColunas: false, santuario: false });
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const audioRef = useRef(null); 

// --- MOTOR DE TELA ATIVA (Evita que o celular apague na prática) ---
  const wakeLockRef = useRef(null);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Tela blindada contra bloqueio.');
      } catch (err) {
        console.error('Erro no WakeLock:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
      console.log('Bloqueio de tela restaurado.');
    }
  };

  // --- SISTEMA DE AUTOSAVE DE EMERGÊNCIA ---
  const autoSaveDataRef = useRef({});

  useEffect(() => {
    autoSaveDataRef.current = {
      user, selectedDate, selectedVirtue, customVirtue, showCustomVirtue, dailyIntention,
      whereIFailed, whatIDidWell, whatILeftUndone, freeEpilogue, didMorning,
      morningDone, eveningDone,
      todayTasksStatus, fvDaily,
      tasksSnapshot: getTasksForToday().map(task => ({
        id: task.id, name: task.name, completed: !!todayTasksStatus[task.id]
      }))
    };
  });

  const performSilentAutoSave = async () => {
    const data = autoSaveDataRef.current;
    if (!data.user) return;

    let randomHour = data.randomReminderHour;
    if (data.morningDone && !randomHour) {
      randomHour = Math.floor(Math.random() * (18 - 10 + 1)) + 10;
      randomHour = String(randomHour).padStart(2, '0') + ':00';
    }

    const updatePayload = {
      userId: data.user.uid,
      date: data.selectedDate,
      morningDone: data.morningDone || false,
      eveningDone: data.eveningDone || false,
      randomReminderHour: randomHour || null, 
      didMorning: data.didMorning !== false,
      virtue: data.showCustomVirtue ? (data.customVirtue || '') : (data.selectedVirtue || ''),
      customVirtue: data.showCustomVirtue ? (data.customVirtue || '') : '',
      intention: data.dailyIntention || '',
      whereIFailed: data.whereIFailed || '',
      whatIDidWell: data.whatIDidWell || '',
      whatILeftUndone: data.whatILeftUndone || '',
      freeEpilogue: data.freeEpilogue || '',
      tasksStatus: data.todayTasksStatus || {},
      tasksSnapshot: data.tasksSnapshot || [],
      fvDaily: data.fvDaily || {
        item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
        horasVoluntariado: '', horasAulaAssistida: '', horasAulaMinistrada: '', gdveTasksStatus: {}, gdveAttendance: false,
        praticas: { tratak: false, recitarHonra: false, recitar7Fases: false, camara: false, templo: false, porta: false, patioAberto: false, patioColunas: false, santuario: false }
      }
    };

    try {
      await setDoc(doc(db, 'entries', `${data.user.uid}_${data.selectedDate}`), updatePayload, { merge: true });
    } catch (e) {
      console.log('Erro no autosave silencioso:', e);
    }
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      performSilentAutoSave();
    }, 60000); 
    
    return () => clearInterval(intervalId);
  }, []);

  const handleRealizarPratica = (key) => {
    setActiveActionMenu(null); 
    
    if (key === 'tratack' || key === 'camara') {
      setActivePracticeId(key); 
      setPracticePhase('intro'); 
      setIsPracticeActive(true); 
    } 
    else if (['porta', 'patioAberto', 'patioColunas', 'santuario'].includes(key)) {
      setActivePracticeId('templo');
      setTemploSelections({
        porta: fvDaily.praticas?.porta || false,
        patioAberto: fvDaily.praticas?.patioAberto || false,
        patioColunas: fvDaily.praticas?.patioColunas || false,
        santuario: fvDaily.praticas?.santuario || false
      });
      setPracticePhase('intro'); 
      setIsPracticeActive(true); 
    } 
    else if (key === 'recitarHonra' || key === 'recitar7Fases') {
      setActivePracticeId(key);
      setPracticePhase('practice'); // Pula a intro e vai direto pra tela
      setIsPracticeActive(true);
      enterFullScreen(); // Liga a tela cheia e o WakeLock para não apagar!
    }
    else {
      alert('Prática não reconhecida.');
    }
  };

  const enterFullScreen = () => {
    requestWakeLock(); // LIGA A TELA AQUI
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(e => console.log(e)); }
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
  };

  const exitFullScreen = () => {
    releaseWakeLock(); // DESLIGA A TELA AQUI
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) { document.exitFullscreen().catch(e => console.log(e)); }
      else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
    }
  };

  const virtues = [
    // --- VIRTUDES CLÁSSICAS ---
    { name: "Paciência", shortDesc: "A ciência da paz", description: "Capacidade de suportar as adversidades sem se alterar, compreendendo os ritmos naturais do tempo e o processo das coisas.", practices: "• Não reagir à primeira provocação\n• Esperar 10 segundos antes de responder\n• Aceitar o ritmo das outras pessoas", quote: "A paciência não é a capacidade de esperar, mas como nos comportamos enquanto esperamos.", quoteAuthor: "J.A. Livraga", color: "#4A90E2" },
    { name: "Coragem", shortDesc: "Agir corretamente além do medo", description: "Não é a ausência do medo, mas a ação decidida e reta, movida pelo dever, apesar da presença do medo.", practices: "• Fazer o que deve ser feito, mesmo com receio\n• Assumir a responsabilidade de um erro\n• Defender a verdade de forma justa", quote: "Coragem é a resistência ao medo, o domínio do medo, e não a ausência do medo.", quoteAuthor: "Mark Twain", color: "#E74C3C" },
    { name: "Prudência", shortDesc: "Sabedoria prática em ação", description: "O discernimento que permite escolher os melhores caminhos e meios para alcançar um fim nobre.", practices: "• Avaliar consequências antes de agir\n• Buscar conselho dos mais sábios\n• Silenciar quando não se tem certeza", quote: "A prudência é a verdadeira mãe de todas as virtudes.", quoteAuthor: "Cícero", color: "#16A085" },
    { name: "Justiça", shortDesc: "Dar a cada um o que é seu", description: "A busca pelo equilíbrio e equidade, não segundo a conveniência egoísta, mas segundo o Dharma e a Lei Universal.", practices: "• Não julgar por simpatias ou antipatias\n• Cumprir com as próprias obrigações\n• Reconhecer o mérito do outro", quote: "A justiça não é outra coisa senão a conveniência do homem em sociedade.", quoteAuthor: "Platão", color: "#C0392B" },
    { name: "Disciplina", shortDesc: "O discipulado interior", description: "Não como castigo, mas como o método pelo qual o discípulo alinha sua personalidade inferior aos ditames de sua Alma.", practices: "• Cumprir o cronograma estabelecido\n• Fazer as práticas sem ceder à preguiça\n• Terminar o que se começou", quote: "A disciplina é a ponte entre as metas e as realizações.", quoteAuthor: "Jim Rohn", color: "#34495E" },
    { name: "Devoção", shortDesc: "O Amor direcionado ao Alto", description: "O fogo interno (Bhakti) que move o ser humano a entregar-se a uma causa sagrada, a um ideal ou ao Mestre.", practices: "• Realizar ações cotidianas como oferenda\n• Manter o altar ou espaço de estudo sagrado\n• Estudar textos sagrados com reverência", quote: "Aquele que realiza todas as suas ações por Mim, e para quem Eu sou a meta suprema, esse chega a Mim.", quoteAuthor: "Bhagavad Gita", color: "#9B59B6" },
    
    // --- PILARES DA NOVA ACRÓPOLE ---
    { name: "Investigação", shortDesc: "A busca sincera pela Verdade", description: "O estudo comparado que não aceita dogmas cegos, mas busca as leis universais ocultas na Natureza e no homem.", practices: "• Questionar os porquês antes de aceitar\n• Ler uma página de filosofia profunda\n• Observar as leis da natureza no dia a dia", quote: "Não há religião superior à Verdade.", quoteAuthor: "H.P. Blavatsky", color: "#2980B9" },
    { name: "Serviço", shortDesc: "Voluntariado ativo e consciente", description: "O ato de colocar as próprias mãos, mente e coração a serviço da humanidade e dos ideais de fraternidade, sem apego aos frutos.", practices: "• Fazer o trabalho invisível que ninguém quer fazer\n• Ajudar o grupo de trabalho (GDVE)\n• Renunciar ao conforto pelo dever", quote: "Dorme o homem que trabalha para si. Desperta o que trabalha para a humanidade.", quoteAuthor: "J.A. Livraga", color: "#F39C12" },
    { name: "Generosidade", shortDesc: "Dar livremente sem esperar retorno", description: "Compartilhar tempo, atenção e sabedoria. Na via esotérica, a verdadeira generosidade é dar oportunidades ao outro.", practices: "• Ouvir ativamente sem interromper\n• Partilhar conhecimento sem vaidade\n• Doar tempo para a escola ou para alguém", quote: "O pouco que se dá com o coração vale muito; o muito que se dá sem ele, não vale nada.", quoteAuthor: "Délia Steinberg Guzmán", color: "#27AE60" },
    { name: "Beleza", shortDesc: "O resplendor da Verdade", description: "A percepção estética e moral da harmonia em todas as coisas. A Beleza como a ponte que nos leva em direção a Deus.", practices: "• Ouvir música clássica com atenção\n• Arrumar-se com dignidade\n• Falar palavras limpas e elevadas", quote: "A beleza é o esplendor da verdade.", quoteAuthor: "Platão", color: "#E84393" },
    { name: "Bondade", shortDesc: "A manifestação do Bem", description: "A inclinação natural e treinada da Vontade em direção à Luz, promovendo o bem, a compaixão e o amparo a todos os seres.", practices: "• Evitar a crítica destrutiva\n• Olhar o lado luminoso das pessoas\n• Agir para aliviar a carga do outro", quote: "A verdadeira bondade consiste não apenas em não fazer o mal, mas em nem sequer desejá-lo.", quoteAuthor: "Sêneca", color: "#FF69B4" },
    { name: "Ordem", shortDesc: "A expressão da Lei Universal", description: "A capacidade de alinhar a própria vida, o espaço e a mente ao grande ritmo do Cosmos.", practices: "• Arrumar a própria cama pela manhã\n• Manter os apontamentos de estudo organizados\n• Fazer uma coisa de cada vez", quote: "A ordem é a primeira lei do céu.", quoteAuthor: "Alexander Pope", color: "#7B68EE" },
    
    // --- O FOGO E A MENTE ---
    { name: "Entusiasmo", shortDesc: "Deus dentro de si", description: "O 'En Theos'. A energia ígnea e divina que contagia, que acorda almas adormecidas e nos dá força para continuar a marcha.", practices: "• Sorrir perante uma dificuldade\n• Transmitir força ao grupo de GDVE\n• Realizar uma tarefa mecânica com alegria", quote: "O entusiasmo é a força divina em movimento; é Deus no homem.", quoteAuthor: "Délia Steinberg Guzmán", color: "#FF5722" },
    { name: "Vontade", shortDesc: "O motor do Espírito", description: "Não é o desejo fugaz, mas o Ícto. O raio de força espiritual que corta a inércia e realiza o plano mental na matéria.", practices: "• Fazer imediatamente algo que está adiando\n• Dominar o corpo (ficar imóvel em meditação)\n• Impor uma pequena renúncia física", quote: "Onde há Vontade, há um Caminho.", quoteAuthor: "Sri Ram", color: "#C0392B" },
    { name: "Atenção", shortDesc: "A presença do Ser", description: "Estar plenamente presente. Onde está a atenção, está o Prana, a vida e a consciência humana.", practices: "• Escutar o outro sem formular respostas\n• Lavar a louça ou caminhar com atenção plena\n• Tratak e exercícios de fixação", quote: "Atenção é o caminho para a imortalidade; a desatenção é o caminho da morte.", quoteAuthor: "Dhammapada", color: "#3498DB" },
    { name: "Memória", shortDesc: "O cofre do passado vivo", description: "O resgate consciente da tradição, do próprio caminho e das lições já aprendidas. Relembrar de si mesmo.", practices: "• Recordar o que estudou ontem (Exercício Pitagórico)\n• Lembrar por que começou no caminho\n• Fazer o Prólogo e o Epílogo com fidelidade", quote: "O homem é sua memória. A memória é a força da nossa identidade.", quoteAuthor: "J.A. Livraga", color: "#8E44AD" },
    
    // --- O GUERREIRO INTERIOR ---
    { name: "Perseverança", shortDesc: "Continuar a despeito das quedas", description: "A força para levantar-se após a queda, retomar o passo e continuar a marchar, sem se deixar vencer pela frustração.", practices: "• Voltar a fazer a prática que abandonou\n• Tentar mais uma vez após falhar\n• Não usar o erro como desculpa", quote: "A perseverança é mãe da boa sorte.", quoteAuthor: "Miguel de Cervantes", color: "#D35400" },
    { name: "Constância", shortDesc: "Estabilidade no esforço", description: "O nível superior da perseverança. É não apenas tentar, mas manter um ritmo constante, inalterado pelos humores ou pelo clima.", practices: "• Fazer o que planejou mesmo sem vontade\n• Manter o ritmo do Diário Filosófico\n• Assiduidade nas aulas e compromissos", quote: "A gota d'água perfura a rocha não pela sua força, mas pela sua constância.", quoteAuthor: "Ovídio", color: "#2ECC71" },
    { name: "Intuição", shortDesc: "A voz silenciosa da Alma", description: "A percepção direta da Verdade, sem passar pela lógica mecânica (Kama-Manas). O clarão de Buddhi.", practices: "• Fazer 5 minutos de silêncio absoluto\n• Escutar o coração na tomada de decisão\n• Observar símbolos na natureza", quote: "A intuição não é a inimiga da razão, mas sua sucessora alada.", quoteAuthor: "J.A. Livraga", color: "#9B59B6" },
    { name: "Ousadia", shortDesc: "A audácia para a Luz", description: "A coragem dinâmica. Lançar-se rumo ao ideal, romper a fronteira do conformismo e tentar o impossível.", practices: "• Dar o primeiro passo num grande projeto\n• Falar em público se tiver oportunidade\n• Romper uma rotina cômoda", quote: "Ousai, e vossas forças aumentarão.", quoteAuthor: "Joana d'Arc", color: "#E67E22" },
    
    // --- O CAMINHO ALQUÍMICO ---
    { name: "Transmutar", shortDesc: "O chumbo em ouro", description: "A Alquimia interior: pegar a emoção densa (raiva, dor, medo) e elevá-la à sua oitava superior (ação reta, amor, sabedoria).", practices: "• Converter uma crítica recebida em ação de melhora\n• Responder à rispidez com amabilidade\n• Usar o cansaço como combustível de prova", quote: "O Universo é transformação; a nossa vida é o que os nossos pensamentos fazem dela.", quoteAuthor: "Marco Aurélio", color: "#F1C40F" },
    { name: "Concórdia", shortDesc: "O coração unificado (Con-Cordis)", description: "A capacidade de unir os corações em torno de um Ideal, superando o atrito das personalidades na Escola ou GDVE.", practices: "• Ceder numa discussão onde só há vaidade em jogo\n• Fazer um elogio sincero a um companheiro\n• Buscar o ponto de união, não o de cisão", quote: "Se quereis que vosso coração encontre concórdia, ide ao centro, que é o Espírito.", quoteAuthor: "Sri Ram", color: "#1ABC9C" },
    { name: "Fortaleza", shortDesc: "O pilar do templo", description: "A força para sustentar a si mesmo e aos outros nos momentos de crise. Ser um bastião da Lei.", practices: "• Não reclamar de dor física leve ou calor/frio\n• Sustentar moralmente alguém abatido\n• Ler os Bastiões com intenção guerreira", quote: "Sofre e suporta: não há homem forte sem o fogo da provação.", quoteAuthor: "Sêneca", color: "#7F8C8D" },
    { name: "Nobreza", shortDesc: "A atitude do cavaleiro interior", description: "Viver acima da mediocridade. Não é um título de sangue, mas a qualidade de um caráter que não se curva à baixeza.", practices: "• Portar-se com elegância, inclusive a sós\n• Recusar fofocas ou palavras torpes\n• Defender a honra de quem não está presente", quote: "A verdadeira nobreza está em sermos superiores ao nosso antigo eu.", quoteAuthor: "Ernest Hemingway", color: "#FFD700" },
    { name: "Integração", shortDesc: "A gota no oceano", description: "Compreender que o pequeno 'eu' faz parte de um Grande Corpo. Integrar-se à humanidade e à Hierarquia.", practices: "• Oferecer o trabalho pessoal ao Ideal Maior\n• Sincronizar-se com as necessidades da Escola\n• Sentir-se peça de uma grande máquina", quote: "O que não é útil ao enxame, não é útil à abelha.", quoteAuthor: "Marco Aurélio", color: "#3498DB" },
    
    // --- O COMPROMISSO ---
    { name: "Dever", shortDesc: "A Vontade de Deus no homem", description: "Fazer o que tem de ser feito por puro amor à Lei (Dharma). Sem fugas, sem negociações.", practices: "• Fazer uma tarefa apenas porque é o certo\n• Dispensar a recompensa final\n• Analisar as omissões no Exame Noturno", quote: "Faça o seu dever, porque a ação é melhor do que a inação.", quoteAuthor: "Bhagavad Gita", color: "#C0392B" },
    { name: "Dignidade", shortDesc: "O respeito ao ser humano", description: "Manter-se de pé internamente. Tratar a si mesmo e aos demais com a gravidade que a Alma exige.", practices: "• Cumprir com as próprias palavras\n• Recusar baixar o nível da conversa\n• Arrumar-se de forma asseada e polida", quote: "Nenhum homem é livre se não for senhor de si mesmo.", quoteAuthor: "Epicteto", color: "#8E44AD" },
    { name: "Fidelidade", shortDesc: "Lealdade à Luz", description: "Fidelidade à promessa, à ideia, ao Mestre e ao próprio ser interior. Manter no escuro o que se jurou na luz.", practices: "• Não abandonar os preceitos quando ninguém vê\n• Cumprir a recitação diária do Código de Honra\n• Honrar os compromissos assumidos", quote: "O verdadeiro cavaleiro é aquele que se mantém fiel quando todos os outros fogem.", quoteAuthor: "J.A. Livraga", color: "#2980B9" },
    { name: "Mística", shortDesc: "A união com o Sagrado", description: "A percepção de que a vida tem um fio condutor invisível e sagrado. Retirar o véu do tédio mecânico da existência.", practices: "• Realizar o Templo Interior (Câmara/Pátio/Santuário)\n• Ver Deus num detalhe da Natureza\n• Estudar os Mistérios com a mente aberta", quote: "Mística é ter sede de Deus.", quoteAuthor: "J.A. Livraga", color: "#6C3483" },
    { name: "Discipulado", shortDesc: "A condição de quem aprende", description: "Colocar-se em posição de aluno do Universo e do Instrutor. Ter a taça vazia para receber a Água da Sabedoria.", practices: "• Aceitar uma correção sem se justificar\n• Copiar o exemplo dos maiores\n• Estudar ativamente os ensinamentos da Escola", quote: "Quando o discípulo está pronto, o Mestre aparece.", quoteAuthor: "O Caibalion", color: "#27AE60" }
  ];

  const philosophicalQuotes = [
    // Clássicos e Estoicos
    { text: "Que ninguém hesite em se dedicar à filosofia enquanto jovem, nem se canse de fazê-lo depois de velho.", author: "Epicuro" },
    { text: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.", author: "Sêneca" },
    { text: "A felicidade não consiste em adquirir e gozar, mas em não desejar nada.", author: "Epicteto" },
    { text: "Conhece-te a ti mesmo e conhecerás o universo e os deuses.", author: "Oráculo de Delfos" },
    { text: "A vida não examinada não vale a pena ser vivida.", author: "Sócrates" },
    { text: "Não percas tempo discutindo sobre o que um homem bom deve ser. Sê um.", author: "Marco Aurélio" },
    { text: "Tudo o que ouvimos é uma opinião, não um fato. Tudo o que vemos é uma perspectiva, não a verdade.", author: "Marco Aurélio" },
    { text: "O homem corajoso não é o que não sente medo, mas o que conquista esse medo.", author: "Aristóteles" },
    
    // Sabedoria Oriental e Esotérica
    { text: "O homem é feito pela sua crença. Como ele acredita, assim ele é.", author: "Bhagavad Gita" },
    { text: "A mente é tudo. O que você pensa, você se torna.", author: "Buda" },
    { text: "O maior domínio é o domínio de si mesmo.", author: "Buda" },
    { text: "Não há religião superior à verdade.", author: "H. P. Blavatsky" },
    { text: "Seja indulgente com as fraquezas alheias, mas rigoroso com as suas próprias.", author: "H. P. Blavatsky (A Voz do Silêncio)" },
    { text: "O sábio molda a si mesmo.", author: "Dhammapada" },
    { text: "Para o homem resoluto e determinado, não existe a palavra impossível.", author: "Sri Ram" },

    // Nova Acrópole (Jorge Ángel Livraga e Délia Steinberg)
    { text: "A melhor maneira de vencer as trevas não é lutar contra elas, mas acender uma luz.", author: "J.A. Livraga" },
    { text: "Um Ideal é o oxigênio da Alma.", author: "J.A. Livraga" },
    { text: "Temos que forjar uma Juventude que não precise de esperanças artificiais, mas da força dos seus próprios Ideais.", author: "J.A. Livraga" },
    { text: "As circunstâncias não fazem o homem, apenas o revelam a si mesmo.", author: "Epicteto / J.A. Livraga" },
    { text: "Ser filósofo não é ler muitos livros, é saber extrair sabedoria de cada ato da Vida.", author: "Délia Steinberg Guzmán" },
    { text: "O heroísmo cotidiano consiste em fazer o bem, de forma oculta e perseverante, todos os dias.", author: "Délia Steinberg Guzmán" },
    { text: "É inútil buscar a paz no mundo se não soubermos plantá-la no coração.", author: "Délia Steinberg Guzmán" },
    { text: "Vontade não é desejar as coisas, é sacrificar-se por elas.", author: "J.A. Livraga" },
    
    // Sabedoria Universal Complementar
    { text: "Mesmo a jornada de mil milhas começa com um único passo.", author: "Lao Tsé" },
    { text: "Aquele que conhece os outros é sábio; aquele que conhece a si mesmo é iluminado.", author: "Lao Tsé" },
    { text: "A verdadeira medida de um homem não se vê nos momentos de conforto, mas nos de desafio e controvérsia.", author: "Martin Luther King Jr." }
  ];

  const getTodayKey = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };


// MÁQUINA DE CORES: Vermelho -> Laranja -> Amarelo -> Verde
  const getTaskColor = (current, target, isDark) => {
    if (current === 0) return isDark ? '#c62828' : '#e53935'; 
    if (current >= target) return isDark ? '#2e7d32' : '#4caf50'; 
    
    const ratio = current / target;
    if (ratio <= 0.34) return isDark ? '#e65100' : '#ff9800'; 
    if (ratio <= 0.67) return isDark ? '#f57f17' : '#ffb300'; 
    return isDark ? '#afb42b' : '#c0ca33'; 
  };

  const getStreakInfo = (days) => {
    const levels = [
      { min: 0, title: "Cinzas Frias", desc: "O fogo aguarda para ser aceso.", icon: Moon },
      { min: 1, title: "Centelha", desc: "A primeira faísca do seu compromisso.", icon: Sparkles },
      { min: 3, title: "Chama Desperta", desc: "O fogo da vontade começa a crescer.", icon: Flame },
      { min: 7, title: "Tocha Iluminadora", desc: "A luz que guia seus passos.", icon: Zap },
      { min: 21, title: "Fogueira", desc: "O calor da disciplina se estabeleceu.", icon: Flame },
      { min: 30, title: "Forja Filosófica", desc: "O caráter é moldado pelo hábito.", icon: Shield },
      { min: 90, title: "Farol de Sabedoria", desc: "Sua constância ilumina a si e aos outros.", icon: Sun },
      { min: 180, title: "Sol Interior", desc: "Luz própria e autodomínio.", icon: Star },
      { min: 365, title: "Fogo Prometeico", desc: "A chama divina da sabedoria inabalável.", icon: Crown }
    ];

    let current = levels[0];
    let next = levels[1];

    for (let i = 0; i < levels.length; i++) {
      if (days >= levels[i].min) {
        current = levels[i];
        next = i + 1 < levels.length ? levels[i + 1] : null; 
      }
    }
    return { current, next };
  };

    const getUserFirstName = () => {
    if (!user) return 'Filósofo';
    if (user.displayName) return user.displayName.split(' ')[0];
    if (user.email) {
      const namePart = user.email.split('@')[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return 'Filósofo';
    };

  const clearAllData = () => {
    setEntries([]);
    setCustomTasks([]);
    setTodayTasksStatus({});
    setStreak(0);
    setLongestStreak(0);
    setMorningDone(false);
    setEveningDone(false);
    setSelectedVirtue('');
    setKuravaData(null);
    setCustomVirtue('');
    setDailyIntention('');
    setMorningChallenges('');
    setMorningVehicles('');
    setWhereIFailed('');
    setWhatIDidWell('');
    setWhatILeftUndone('');
    setVirtueGoals([]);
    setProjectGoals([]);
    setAcceptedMissions([]);
    setAiSuggestedGoals(null);
    setFvLastCartaDate('');
    setFvNextCartaDate('');
    setFvGdveReuniao('');
    setFvGdveBastiaoName('');
    setFvGdveBastiaoLink('');
    setFvUnlocked(false);
    setLastDrawDate(null);
    setSelectedDate(getTodayKey()); 
    setBooks([]); 
    setFvDaily({
      item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
      horasVoluntariado: '', horasAula: '', gdveTasksStatus: {}, gdveAttendance: false,
      praticas: { tratak: false, recitarHonra: false, recitar7Fases: false, camara: false, templo: false, porta: false, patioAberto: false, patioColunas: false, santuario: false }
    });
  };

  const getTasksForToday = () => {
    const targetDate = new Date(selectedDate + 'T12:00:00'); 
    const currentDayOfWeek = targetDate.getDay(); 
    const currentDayOfMonth = targetDate.getDate();
    const todayObj = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    return customTasks.filter(task => {
      if (!task.recurrence || task.recurrence === 'daily') return true;
      if (task.recurrence === 'weekly') return task.weekDays?.includes(currentDayOfWeek);
      if (task.recurrence === 'monthly') return parseInt(task.monthDay) === currentDayOfMonth;
      if (task.recurrence === 'biweekly' && task.baseDate) {
        const [y, m, d] = task.baseDate.split('-');
        const baseDateObj = new Date(y, m - 1, d);
        const diffTime = todayObj.getTime() - baseDateObj.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays % 14 === 0;
      }
      return true;
    });
  };

  const selectRandomVirtue = async () => {
    if (!canDrawToday()) {
      alert('Você já sorteou sua virtude neste dia! Comprometa-se com ela até o fim do dia. 🎯');
      return;
    }
    const randomIndex = Math.floor(Math.random() * virtues.length);
    const selectedV = virtues[randomIndex].name;
    setSelectedVirtue(selectedV);
    setShowCustomVirtue(false);
    setLastDrawDate(selectedDate);

    if (user) {
      try { await updateDoc(doc(db, 'users', user.uid), { lastDrawDate: selectedDate }); } 
      catch (error) { console.log('Erro ao salvar data do sorteio'); }
    }
  };

  const canDrawToday = () => {
    return lastDrawDate !== selectedDate;
  };

  const handleLogoClick = () => {
    setFvClickCount(prev => prev + 1);
    
    if (fvClickCount >= 6) {
      setFvUnlocked(true);
      loadMod2Config();
      setFvClickCount(0);
      alert('🔓 Modo FV desbloqueado na sessão!');
    }
    setTimeout(() => setFvClickCount(0), 3000);
  };

  const handleFvTabClick = () => {
    setView('fv'); 
  };

  const handleInstantFvLock = async () => {
    setFvUnlocked(false); 
    setView('today'); 
    alert('🔒 Modo FV ocultado com segurança!');
  };

  useEffect(() => {
    if (!user || showInactivityWarning || isPracticeActive) return; 
    
    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setShowInactivityWarning(true), 60000);
    };
    
    const handleActivity = () => resetTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    resetTimer();
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [user, showInactivityWarning, isPracticeActive]);

  useEffect(() => {
    if (user && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const timer = setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Mensagem recebida com o app aberto: ', payload);
      
      if (Notification.permission === 'granted') {
        const isMorning = payload.notification.title.includes('Matinal');
        const correctIcon = isMorning 
          ? 'https://img.icons8.com/ios-filled/512/8b7355/open-book.png' 
          : 'https://img.icons8.com/ios-filled/512/8b7355/owl.png';

        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: correctIcon,
          tag: 'diario-notification' 
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let timer;
    let mouseSafetyTimer;
    let cronometroVisual;
    
    if (practicePhase === 'practice') {
      // Inicia a contagem de tempo (1 em 1 segundo)
      cronometroVisual = setInterval(() => {
        setTempoDecorrido(prev => prev + 1);
      }, 1000);

      if (activePracticeId === 'tratack') {
        timer = setTimeout(() => { setPracticePhase('done'); clearInterval(cronometroVisual); }, 180000); 
        mouseSafetyTimer = setTimeout(() => setTratakMouseActive(true), 2000);
      }
    } else {
      setTratakMouseActive(false); 
      setTempoDecorrido(0); // Zera se a prática fechou
    }
    
    return () => { clearTimeout(timer); clearTimeout(mouseSafetyTimer); clearInterval(cronometroVisual); };
  }, [practicePhase, activePracticeId]);

  useEffect(() => {
    let intervalId;
    if (showInactivityWarning) {
      intervalId = setInterval(() => {
        setLogoutCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            
            performSilentAutoSave().then(() => {
              signOut(auth);
              setShowInactivityWarning(false);
            });
            
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setLogoutCountdown(15);
    }
    return () => clearInterval(intervalId);
  }, [showInactivityWarning]);

  const keepAlive = () => {
    setShowInactivityWarning(false);
    setLogoutCountdown(15);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserData(currentUser.uid);
        await loadTodayEntry(currentUser.uid);
        await loadAllEntries(currentUser.uid);
        await loadCustomTasks(currentUser.uid);
        await loadLongTermGoals(currentUser.uid);
        await loadFVData(currentUser.uid);
        // ESTA LINHA É A ÂNCORA DOS SEUS LIVROS:
        await loadBooks(currentUser.uid); 
      } else {
        setUser(null);
        clearAllData();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  
  
  const loadUserData = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setTheme(data.theme || 'light');
        setLastDrawDate(data.lastDrawDate || null);
        setFvUnlocked(false); 

        setMorningTime(data.morningTime || '06:00'); 
        setEveningTime(data.eveningTime || '22:00');
        
        if ('Notification' in window && Notification.permission === 'granted') {
          setNotificationsActive(!!data.fcmToken);
        } else {
          setNotificationsActive(false);
        }
      } else {
        await setDoc(doc(db, 'users', uid), {
          createdAt: Timestamp.now(), theme: 'light', lastDrawDate: null, fvUnlocked: false
        });
      }
    } catch (error) { console.error('Erro ao carregar dados:', error); }
  };

  const loadTodayEntry = async (uid, dateToLoad = null) => {
    try {
      const targetDate = dateToLoad || selectedDate;
      const entryDoc = await getDoc(doc(db, 'entries', `${uid}_${targetDate}`));
      
      if (entryDoc.exists()) {
        const data = entryDoc.data();
        setMorningDone(data.morningDone || false);
        setEveningDone(data.eveningDone || false);
        setDidMorning(data.didMorning !== false);
        setSelectedVirtue(data.virtue || '');
        setCustomVirtue(data.customVirtue || '');
        setDailyIntention(data.intention || '');
        setWhereIFailed(data.whereIFailed || '');
        setWhatIDidWell(data.whatIDidWell || '');
        setWhatILeftUndone(data.whatILeftUndone || '');
        setFreeEpilogue(data.freeEpilogue || '');
        setTodayTasksStatus(data.tasksStatus || {});
        setFvDaily(data.fvDaily || {
          item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
          horasVoluntariado: '', horasAula: '', gdveTasksStatus: {}, gdveAttendance: false,
          praticas: { tratak: false, recitarHonra: false, recitar7Fases: false, camara: false, templo: false, porta: false, patioAberto: false, patioColunas: false, santuario: false }
        });
      } else {
        setMorningDone(false);
        setEveningDone(false);
        setDidMorning(true);
        setSelectedVirtue('');
        setCustomVirtue('');
        setDailyIntention('');
        setWhereIFailed('');
        setWhatIDidWell('');
        setWhatILeftUndone('');
        setFreeEpilogue('');
        setTodayTasksStatus({});
        setFvDaily({
          item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
          horasVoluntariado: '', horasAulaAssistida: '', horasAulaMinistrada: '', gdveTasksStatus: {}, gdveAttendance: false,
          praticas: { tratak: false, recitarHonra: false, recitar7Fases: false, camara: false, templo: false, porta: false, patioAberto: false, patioColunas: false, santuario: false }
        });
      }

      if (!dailyQuote) {
        const randomQuote = philosophicalQuotes[Math.floor(Math.random() * philosophicalQuotes.length)];
        setDailyQuote(randomQuote);
      }
    } catch (error) {
      console.error('Erro ao carregar entrada:', error);
    }
  };

  const loadAllEntries = async (uid) => {
    try {
      const q = query(collection(db, 'entries'), where('userId', '==', uid));
      const querySnapshot = await getDocs(q);
      const loadedEntries = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const hasFvData = data.fvDaily && (
          data.fvDaily.item1 || data.fvDaily.item2 || data.fvDaily.item34 || data.fvDaily.item5 || data.fvDaily.item6 || data.fvDaily.item7 || 
          (data.fvDaily.praticas && Object.values(data.fvDaily.praticas).some(v => v === true))
        );
        
        if (data.morningDone || data.eveningDone || hasFvData) { 
          loadedEntries.push({ id: doc.id, ...data });
        }
      });
      
      loadedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEntries(loadedEntries);

      if (loadedEntries.length > 0) {
        let maxStreak = 1;
        let tempCalc = 1;
        const streakEntries = loadedEntries.filter(e => e.eveningDone);
        
        if (streakEntries.length > 0) {
          for (let i = 0; i < streakEntries.length - 1; i++) {
            const date1 = new Date(streakEntries[i].date + 'T12:00:00');
            const date2 = new Date(streakEntries[i+1].date + 'T12:00:00');
            const diffDays = Math.round((date1 - date2) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
              tempCalc++;
              if (tempCalc > maxStreak) maxStreak = tempCalc;
            } else if (diffDays > 1) {
              tempCalc = 1;
            }
          }
        } else {
          maxStreak = 0;
        }
        setLongestStreak(maxStreak);

        const todayKeyStr = getTodayKey();
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yesterdayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        let currentStreak = 0;
        let dateToCheck = streakEntries.some(e => e.date === todayKeyStr) ? todayKeyStr : (streakEntries.some(e => e.date === yesterdayKey) ? yesterdayKey : null);
        
        if (dateToCheck) {
          for (const entry of streakEntries) {
            if (entry.date === dateToCheck) {
              currentStreak++;
              const prevD = new Date(dateToCheck + 'T12:00:00');
              prevD.setDate(prevD.getDate() - 1);
              dateToCheck = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
            } else if (entry.date < dateToCheck) {
              break; 
            }
          }
        }
        setStreak(currentStreak);

        let currentFvDiaryStreak = 0;
        let currentFvTasksStreak = 0;
        
        const fvDiaryEntries = loadedEntries.filter(e => e.fvDaily && (e.fvDaily.item1 || e.fvDaily.item2 || e.fvDaily.item34 || e.fvDaily.item5 || e.fvDaily.item6 || e.fvDaily.item7));
        const fvTasksEntries = loadedEntries.filter(e => e.fvDaily && e.fvDaily.praticas && Object.values(e.fvDaily.praticas).some(feito => feito === true));

        let dateToCheckFvDiary = fvDiaryEntries.some(e => e.date === todayKeyStr) ? todayKeyStr : (fvDiaryEntries.some(e => e.date === yesterdayKey) ? yesterdayKey : null);
        if (dateToCheckFvDiary) {
          for (const entry of fvDiaryEntries) {
            if (entry.date === dateToCheckFvDiary) {
              currentFvDiaryStreak++;
              const prevD = new Date(dateToCheckFvDiary + 'T12:00:00');
              prevD.setDate(prevD.getDate() - 1);
              dateToCheckFvDiary = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
            } else if (entry.date < dateToCheckFvDiary) { break; }
          }
        }
        
        let dateToCheckFvTasks = fvTasksEntries.some(e => e.date === todayKeyStr) ? todayKeyStr : (fvTasksEntries.some(e => e.date === yesterdayKey) ? yesterdayKey : null);
        if (dateToCheckFvTasks) {
          for (const entry of fvTasksEntries) {
            if (entry.date === dateToCheckFvTasks) {
              currentFvTasksStreak++;
              const prevD = new Date(dateToCheckFvTasks + 'T12:00:00');
              prevD.setDate(prevD.getDate() - 1);
              dateToCheckFvTasks = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
            } else if (entry.date < dateToCheckFvTasks) { break; }
          }
        }
        
        setFvDiaryStreak(currentFvDiaryStreak);
        setFvTasksStreak(currentFvTasksStreak);
      } else {
        setStreak(0);
        setLongestStreak(0);
        setFvDiaryStreak(0);
        setFvTasksStreak(0);
      }
    } catch (error) { console.error('Erro ao carregar entradas:', error); }
  };

  const loadBooks = async (uid) => {
    if (!uid) return;
    try {
      const docRef = doc(db, 'userBooks', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setBooks(docSnap.data().books || []);
        const savedRec = docSnap.data().bookRecommendation;
        if (savedRec && savedRec.generatedAt) {
          const ageInDays = (new Date() - new Date(savedRec.generatedAt)) / (1000 * 60 * 60 * 24);
          if (ageInDays < 7) setBookRecommendation(savedRec);
          else setBookRecommendation(null);
        }
      }
    } catch (error) { console.error('Erro ao carregar livros:', error); }
  };

  const saveBooksToDb = async (updatedBooks) => {
    // Truque Mágico: O JSON.stringify remove automaticamente qualquer campo 'undefined' escondido nos livros!
    const livrosSanitizados = JSON.parse(JSON.stringify(updatedBooks));
    
    setBooks(livrosSanitizados);
    
    if (user) {
      try { 
        await setDoc(doc(db, 'userBooks', user.uid), { books: livrosSanitizados }, { merge: true }); 
        console.log("Estante salva e purificada com sucesso.");
      } catch (error) { 
        console.error('Erro ao salvar livros:', error); 
      }
    }
  };

  // --- MOTOR DE VISÃO COMPUTACIONAL (Fase 4) ---
  const handleShelfScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if(!aiConsent) return alert('Autorize a IA nas Configurações do Diário para usar o Olho de Argos.');

    setShowScannerModal(true);
    setIsScanningShelf(true);
    setDetectedBooks([]);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = reader.result.split(',')[1];
      
      const prompt = `Você é um bibliotecário sábio e especialista em obras clássicas, filosofia e literatura. 
      Analise a imagem desta estante ou pilha de livros físicos. Leia as lombadas ou as capas.
      Identifique o máximo de livros legíveis.
      
      Retorne ESTRITAMENTE um array JSON de objetos. 
      Exemplo: [{"title": "Meditações", "author": "Marco Aurélio"}, {"title": "A República", "author": "Platão"}]`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ 
              parts: [
                { text: prompt },
                { inlineData: { mimeType: file.type, data: base64String } }
              ] 
            }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        const data = await response.json();
        const rawDetected = JSON.parse(data.candidates[0].content.parts[0].text);
        
        // A MÁGICA INVISÍVEL: A IA busca a capa e páginas de cada livro silenciosamente!
        const enrichedBooks = await Promise.all(rawDetected.map(async (b) => {
          try {
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(b.title + ' ' + b.author)}&maxResults=1&langRestrict=pt`);
            const json = await res.json();
            const info = json.items?.[0]?.volumeInfo;
            return {
              title: b.title,
              author: b.author,
              totalPages: info?.pageCount || 0,
              thumbnail: info?.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
              category: info?.categories?.[0] || 'Filosofia'
            };
          } catch(e) {
            return { title: b.title, author: b.author, totalPages: 0, thumbnail: null, category: 'Filosofia' };
          }
        }));

        setDetectedBooks(enrichedBooks);
      } catch(err) {
        console.error("Erro na Visão:", err);
        alert("O Oráculo não conseguiu focar a visão. A foto estava borrada ou a luz estava fraca.");
        setShowScannerModal(false);
      } finally {
        setIsScanningShelf(false);
        e.target.value = null; 
      }
    };
  };

  // --- PROCESSADOR RÁPIDO DO ESCANER ---
  const handleQuickAdd = (detectedBook, status) => {
    let currentPage = 0;
    let finishedDate = null;

    if (status === 'lido') {
      currentPage = detectedBook.totalPages;
      finishedDate = new Date().toISOString();
    } else if (status === 'lendo') {
      const input = prompt(`Você está em qual página de "${detectedBook.title}"? (Total: ${detectedBook.totalPages})`, '0');
      if (input === null) return; // Se o usuário cancelar, não salva
      currentPage = Math.min(detectedBook.totalPages, parseInt(input) || 0);
    }

    const newBook = {
      id: `book_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ...detectedBook,
      currentPage,
      finishedDate
    };

    // Salva no banco e já põe na estante
    saveBooksToDb([newBook, ...books]);

    // Remove da lista do Scanner para dar sensação de "tarefa cumprida"
    setDetectedBooks(prev => prev.filter(b => b.title !== detectedBook.title));
  };

  const searchBooks = async (query) => {
    if (!query.trim()) return;
    setIsSearchingBooks(true);
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=15&langRestrict=pt`);
      const data = await response.json();
      
      const formattedResults = data.items?.filter(item => {
        const info = item.volumeInfo;
        // SÓ ACEITA SE: Tiver título, Tiver autor, Tiver capa E Tiver mais de 0 páginas
        return info.title && info.authors && info.imageLinks?.thumbnail && info.pageCount > 0;
      }).map(item => ({
        id: item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.join(', ') || 'Autor desconhecido',
        totalPages: item.volumeInfo.pageCount || 0,
        thumbnail: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
        category: item.volumeInfo.categories?.[0] || 'Filosofia'
      })) || [];
      
      setBookSearchResults(formattedResults);
    } catch (error) {
      console.error("Erro na busca do Google Books:", error);
    } finally {
      setIsSearchingBooks(false);
    }
  };

  // --- GATILHO AUTOMÁTICO DO ORÁCULO (Fase 3) ---
  // Se o usuário tem livros, mas não tem recomendação (ou ela expirou), gera sozinho em background.
  useEffect(() => {
    if (books.length > 0 && bookRecommendation === null && !isGeneratingRecommendation && aiConsent) {
      generateBookRecommendation();
    }
  }, [books, bookRecommendation, aiConsent, isGeneratingRecommendation]);

  const generateBookRecommendation = async () => {
    if (!user || books.length === 0) return;
    setIsGeneratingRecommendation(true);

    const livrosAtuais = books.map(b => `${b.title} (${b.author}) - Categoria: ${b.category}`).join(' | ');

    const prompt = `Você é um bibliotecário da Escola de Filosofia Nova Acrópole. 
    O aluno está lendo ou já leu estes livros: ${livrosAtuais}.
    
    Com base no perfil dele, sugira UM ÚNICO livro clássico de filosofia, história ou humanismo que seja o próximo passo ideal. 
    Escolha livros de autores como Marco Aurélio, Sêneca, Platão, Helena Blavatsky, Jorge Ángel Livraga ou similares.
    
    Retorne ESTRITAMENTE um JSON:
    {
      "title": "Título exato do livro",
      "author": "Autor",
      "reason": "Uma frase curta explicando por que este livro complementa as leituras atuais."
    }`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await response.json();
      const rec = JSON.parse(data.candidates[0].content.parts[0].text);

// Buscamos a capa, mas agora com filtro de segurança
      const bookData = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(rec.title + ' ' + rec.author)}&maxResults=5`);
      const bookInfo = await bookData.json();
      
      // Encontra o primeiro resultado que tenha capa e páginas válidas
      const validBook = bookInfo.items?.find(item => item.volumeInfo.imageLinks?.thumbnail && item.volumeInfo.pageCount > 0);

      if (!validBook) {
        // Se a sugestão da IA não tem dados bons no Google, tentamos gerar outra ou limpamos
        setBookRecommendation(null); 
        return;
      }

      const thumbnail = validBook.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:');
      const finalRec = { ...rec, thumbnail, generatedAt: new Date().toISOString() };

      setBookRecommendation(finalRec);
      await setDoc(doc(db, 'userBooks', user.uid), { bookRecommendation: finalRec }, { merge: true });

    } catch (e) {
      console.error("Erro ao gerar recomendação:", e);
    } finally {
      setIsGeneratingRecommendation(false);
    }
  };

  

  const loadCustomTasks = async (uid) => {
    try {
      const tasksDoc = await getDoc(doc(db, 'customTasks', uid));
      if (tasksDoc.exists()) setCustomTasks(tasksDoc.data().tasks || []);
    } catch (error) { console.error('Erro ao carregar tarefas:', error); }
  };

  const loadLongTermGoals = async (uid) => {
    try {
      const goalsDoc = await getDoc(doc(db, 'longTermGoals', uid));
      if (goalsDoc.exists()) {
        const data = goalsDoc.data();
        setVirtueGoals(data.virtueGoals || []);
        setProjectGoals(data.projectGoals || []);
        setAcceptedMissions(data.acceptedMissions || []);
        setAiSuggestedGoals(data.aiSuggestedGoals || null);
      }
    } catch (error) { console.error('Erro ao carregar metas:', error); }
  };

  const loadFVData = async (uid) => {
    
    if (!uid) return;
    try {
      const docRef = doc(db, 'fvData', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Suas outras memórias sendo carregadas:
        if (data.kuravaData) setKuravaData(data.kuravaData);
        if (data.balloonActions) setBalloonActions(data.balloonActions);
        
        // COLE AQUI:
        setKuravaEnabled(data.kuravaEnabled !== false);
        setAiConsent(data.aiConsent || false);

        // 1. Puxa as Datas e Planejamento
        setFvLastCartaDate(data.lastCartaDate || '');
        setFvNextCartaDate(data.nextCartaDate || '');
        setFvGdveReuniao(data.gdveReuniao || '');
        setFvMasterName(data.fvMasterName || '');
        setFvLastMeetingDate(data.fvLastMeetingDate || '');

        // 2. Puxa as Tarefas e Status do Grupo
        setFvGdveTasks(data.gdveTasks || []);
        setFvGdveCycleStatus(data.gdveCycleStatus || {});
        setFvGdveBastiaoName(data.fvGdveBastiaoName || '');
        setFvGdveBastiaoLink(data.fvGdveBastiaoLink || '');

        // 3. Puxa os Relatórios da IA
        setDiscipularSynthesis(data.discipularSynthesis || null);
        setFvAiMetricas(data.fvAiMetricas || null);
        setFvAiAuditoria(data.fvAiAuditoria || null);
        setFvAiLexical(data.fvAiLexical || null);

        // 4. Limpador Automático de 30 dias para a Síntese Aberta
        if (data.technicalSynthesis && data.technicalSynthesisDate) {
          const dataGeracao = new Date(data.technicalSynthesisDate);
          const hoje = new Date();
          const diferencaDias = (hoje - dataGeracao) / (1000 * 60 * 60 * 24);
          
          if (diferencaDias > 30) {
            setTechnicalSynthesis(null);
            setBalloonActions(data.balloonActions || null);
            setAiGuarda(null); setAiConquistas(null); setAiInvestigacoes(null);
          } else {
            setTechnicalSynthesis(data.technicalSynthesis);
            setAiGuarda(data.aiGuarda || null);
            setAiConquistas(data.aiConquistas || null);
            setAiInvestigacoes(data.aiInvestigacoes || null);
          }
        } else {
          setTechnicalSynthesis(data.technicalSynthesis || null);
          setBalloonActions(data.balloonActions || null);
          setAiGuarda(data.aiGuarda || null);
          setAiConquistas(data.aiConquistas || null);
          setAiInvestigacoes(data.aiInvestigacoes || null);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados da nuvem:", error);
    } finally {
      // ISSO AQUI AVISA O GATILHO QUE O FIREBASE TERMINOU DE ENTREGAR OS DADOS
      setIsCloudDataLoaded(true); 
    }
  };


  const loadMod2Config = async () => {
    if (!user || fvConfig) return;
    setIsDownloadingConfig(true);
    try {
      // Usa a pasta autorizada do Firebase (fvData) para guardar o motor
      const docRef = doc(db, 'fvData', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().config) {
        setFvConfig(docSnap.data().config);
      } else {
        // Textos completos originais restaurados
        const initialConfig = {
          tituloAba: "Registro de Ciclo",
          secaoReflexao: "A Escalada (Reflexões)",
          itensCarta: [
            { id: 'item1', label: '1 – VARRER POR DENTRO', desc: 'Exame da personalidade, descobrir os nós, buscar as causas que os geraram, encontrar a fórmula de limpeza (redenção) e aplicá-las.' },
            { id: 'item2', label: '2 – AS LEIS DA MATÉRIA', desc: 'Descobrir como atuam em nós os ciclos da matéria (para não nos afetarem): instintos de conservação/procriação, idade, enfermidade, ânimo, humor, ideias, sentimentos, ambiente.' },
            { id: 'item34', label: '3 e 4 – TRABALHO ORDENADO E EFICAZ', desc: 'Colocar ordem na vida. Necessária disciplina e perseverança: exercícios de ordem e limpeza.' },
            { id: 'item5', label: '5 – ECONOMIA DE TEMPO E ENERGIA', desc: 'Requer atenção.' },
            { id: 'item6', label: '6 – OS VÍCIOS', desc: 'Superar: preguiça, gula e luxúria e outros da mesma natureza (apatia, moleza, debilidade, negligência). Moderar: álcool e fumo. Proibido: drogas.' },
            { id: 'item7', label: '7 – AS VIRTUDES: PERSEVERANÇA E CONSTÂNCIA', desc: 'Perseverança: repetir sem rotina com sentido de perfeição. Constância: estabilidade e consciência elevada. (Nota: Comentar sobre frequência no diário, carta, exercícios, ED, etc).' }
          ],
          praticas: [
            { key: 'tratack', label: 'Tratak' },
            { key: 'recitarHonra', label: 'Recitar Código de Dignidade' },
            { key: 'recitar7Fases', label: 'Recitar 7 fases da ED' },
            { key: 'camara', label: 'Câmara de Purificação' }
          ],
          modulo2: {
            titulo: "Módulo GDVE",
            rotuloLeitura: "Leitura do Ciclo (Bastião)",
            bancoTemas: [
              { name: "Bastiões 1976 - 001 a 006", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23101&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
              { name: "Bastiões 1977 - 007 a 017", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23102&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
              { name: "Bastiões 1978 - 018 a 029", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23103&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
              { name: "Bastiões 1979 - 029 a 039", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23104&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" }
            ]
          }
        };
        await setDoc(docRef, { config: initialConfig }, { merge: true }); 
        setFvConfig(initialConfig); 
      }
    } catch (e) { console.error("Erro ao baixar motor:", e); }
    setIsDownloadingConfig(false);
  };

  const saveCustomTask = async () => {
    if (!newTaskName.trim()) return;
    if (newTaskRecurrence === 'weekly' && (!newTaskWeekDays || newTaskWeekDays.length === 0)) {
      alert('Por favor, selecione pelo menos um dia da semana.');
      return;
    }
    if (newTaskRecurrence === 'biweekly' && !newTaskBaseDate) {
      alert('Por favor, selecione a data de início para a tarefa quinzenal.');
      return;
    }

    const isDuplicate = customTasks.some(t => t.name.toLowerCase().trim() === newTaskName.trim().toLowerCase() && t.id !== editingTaskId);
    if (isDuplicate) {
      alert('Você já tem uma prática cadastrada com este nome!');
      return;
    }

    const uniqueId = editingTaskId || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const taskData = {
      id: uniqueId, name: newTaskName.trim(), recurrence: newTaskRecurrence,
      weekDays: newTaskRecurrence === 'weekly' ? newTaskWeekDays : [],
      monthDay: newTaskRecurrence === 'monthly' ? parseInt(newTaskMonthDay) || 1 : 1,
      baseDate: newTaskRecurrence === 'biweekly' ? newTaskBaseDate : ""
    };

    let newTasks = editingTaskId ? customTasks.map(t => t.id === editingTaskId ? taskData : t) : [...customTasks, taskData];
    const cleanTasksForFirebase = JSON.parse(JSON.stringify(newTasks));

    setCustomTasks(cleanTasksForFirebase);
    setNewTaskName(''); setShowAddTask(false); setEditingTaskId(null);
    setNewTaskRecurrence('daily'); setNewTaskWeekDays([]); setNewTaskMonthDay(1); setNewTaskBaseDate('');

    if (user) {
      try { await setDoc(doc(db, 'customTasks', user.uid), { tasks: cleanTasksForFirebase }); } 
      catch (error) { alert('O Firebase reclamou de algo, mas a tarefa está salva no seu dispositivo.'); }
    }
  };

  const startEditingTask = (task) => {
    setEditingTaskId(task.id); setNewTaskName(task.name); setNewTaskRecurrence(task.recurrence || 'daily');
    setNewTaskWeekDays(task.weekDays || []); setNewTaskMonthDay(task.monthDay || 1); setNewTaskBaseDate(task.baseDate || ''); 
    setShowAddTask(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeCustomTask = async (taskId) => {
    const newTasks = customTasks.filter(t => t.id !== taskId);
    const cleanTasksForFirebase = JSON.parse(JSON.stringify(newTasks));
    setCustomTasks(cleanTasksForFirebase);
    if (user) {
      try { await setDoc(doc(db, 'customTasks', user.uid), { tasks: cleanTasksForFirebase }); } 
      catch (error) { console.error("Erro ao excluir:", error); }
    }
  };

  const toggleTaskStatus = async (taskId) => {
    const newStatus = { ...todayTasksStatus, [taskId]: !todayTasksStatus[taskId] };
    setTodayTasksStatus(newStatus);

    if (user) {
      const todayKey = selectedDate;
      const updatedSnapshot = getTasksForToday().map(task => ({
        id: task.id, name: task.name, completed: !!newStatus[task.id]
      }));

      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          tasksStatus: newStatus, tasksSnapshot: updatedSnapshot
        }, { merge: true }); 
        await loadAllEntries(user.uid);
      } catch (error) { console.error('Erro ao salvar o status da tarefa:', error); }
    }
  };  

  const saveMorning = async () => {
    const finalVirtue = showCustomVirtue ? customVirtue : selectedVirtue;
    if (!finalVirtue || !finalVirtue.trim()) { alert('Por favor, selecione ou digite uma virtude para o dia.'); return; }

    const tasksSnapshot = getTasksForToday().map(task => ({
      id: task.id, name: task.name, completed: !!todayTasksStatus[task.id]
    }));

    const todayKey = selectedDate;

    const randomHour = Math.floor(Math.random() * (18 - 10 + 1)) + 10;
    const randomHourStr = String(randomHour).padStart(2, '0') + ':00'; 

    const entry = {
      userId: user.uid, 
      date: todayKey, 
      morningDone: true, 
      virtue: finalVirtue,
      customVirtue: showCustomVirtue ? customVirtue : '', 
      quote: dailyQuote || null,
      intention: dailyIntention || '', 
      tasksStatus: todayTasksStatus || {},
      tasksSnapshot: tasksSnapshot || [], 
      morningTimestamp: Timestamp.now(),
      randomReminderHour: randomHourStr 
    };

    try {
      await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), entry, { merge: true });
      setMorningDone(true); 
      alert('✅ Prólogo salvo com sucesso!');
    } catch (error) { 
      alert('Erro ao salvar prólogo. Verifique sua conexão.'); 
    }
  };

  const saveEvening = async () => {
    const hasSpecifics = (whereIFailed && whereIFailed.trim()) && (whatIDidWell && whatIDidWell.trim()) && (whatILeftUndone && whatILeftUndone.trim());
    const hasFreeText = freeEpilogue && freeEpilogue.trim();

    if (!hasSpecifics && !hasFreeText) {
      alert('Por favor, responda as 3 perguntas estruturadas OU utilize o campo de Reflexão Livre.'); return;
    }

    const todayKey = selectedDate;
    const tasksSnapshot = getTasksForToday().map(task => ({
      id: task.id, name: task.name, completed: !!todayTasksStatus[task.id]
    }));

    try {
      const updatedEntry = {
        userId: user.uid, date: todayKey, eveningDone: true,
        whereIFailed: whereIFailed || '', whatIDidWell: whatIDidWell || '', whatILeftUndone: whatILeftUndone || '',
        freeEpilogue: freeEpilogue || '',
        didMorning: didMorning !== false, tasksStatus: todayTasksStatus || {},
        tasksSnapshot: tasksSnapshot || [], eveningTimestamp: Timestamp.now()
      };

      await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), updatedEntry, { merge: true });
      
      setEveningDone(true); 
      await loadAllEntries(user.uid);
      alert('✅ Epílogo salvo com sucesso!');
    } catch (error) { 
      console.error(error);
      alert('Erro ao salvar epílogo. Tente novamente.'); 
    }
  };

  const saveLongTermGoals = async (vGoals, pGoals, aMissions) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'longTermGoals', user.uid), { 
        virtueGoals: vGoals || virtueGoals, 
        projectGoals: pGoals || projectGoals, 
        acceptedMissions: aMissions || acceptedMissions,
        updatedAt: Timestamp.now() 
      }, { merge: true });
    } catch (error) { console.error('Erro ao salvar metas:', error); }
  };

  const addVirtueGoal = () => {
    if (!newVirtueGoal.trim()) return;
    const newList = [...virtueGoals, { id: Date.now(), text: newVirtueGoal, completed: false }];
    setVirtueGoals(newList); setNewVirtueGoal(''); saveLongTermGoals(newList, null, null);
  };

  const addProjectGoal = () => {
    if (!newProjectGoal.trim()) return;
    const newList = [...projectGoals, { id: Date.now(), text: newProjectGoal, completed: false }];
    setProjectGoals(newList); setNewProjectGoal(''); saveLongTermGoals(null, newList, null);
  };

  const toggleGoal = (id, type) => {
    if (type === 'virtue') {
      const newList = virtueGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
      setVirtueGoals(newList); saveLongTermGoals(newList, null, null);
    } else {
      const newList = projectGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
      setProjectGoals(newList); saveLongTermGoals(null, newList, null);
    }
  };

  const removeGoal = (id, type) => {
    if(window.confirm("Deseja excluir esta meta?")) {
      if (type === 'virtue') {
        const newList = virtueGoals.filter(g => g.id !== id);
        setVirtueGoals(newList); saveLongTermGoals(newList, null, null);
      } else {
        const newList = projectGoals.filter(g => g.id !== id);
        setProjectGoals(newList); saveLongTermGoals(null, newList, null);
      }
    }
  };

  // --- MOTOR DAS MISSÕES DE CICLO (IA E JURAMENTO) ---
  const confirmAcceptMission = () => {
    if (!missionToAccept) return;
    const newMission = {
      id: Date.now(),
      titulo: missionToAccept.titulo,
      descricao: missionToAccept.descricao,
      startDate: getTodayKey(),
      completed: false
    };
    const newList = [...acceptedMissions, newMission];
    setAcceptedMissions(newList);
    saveLongTermGoals(null, null, newList);
    setMissionToAccept(null);
  };

  const toggleAcceptedMission = (id) => {
    const newList = acceptedMissions.map(m => m.id === id ? { ...m, completed: !m.completed } : m);
    setAcceptedMissions(newList);
    saveLongTermGoals(null, null, newList);
  };

  const removeAcceptedMission = (id) => {
    if(window.confirm("Deseja abandonar esta missão? A verdadeira derrota é desistir de lutar.")) {
      const newList = acceptedMissions.filter(m => m.id !== id);
      setAcceptedMissions(newList);
      saveLongTermGoals(null, null, newList);
    }
  };

  // --- SISTEMA DE AUDITORIA ATIVA: O CAMPO DE KURUKSHETRA ---
  const generateKuravaAnalysis = async () => {
    if (!user) return;
    if (!aiConsent) { alert("Para acionar o Oráculo, autorize o uso da IA no menu de 'Opções > Configurações'."); return; }
    setIsGeneratingKurava(true);

    try {
      const hoje = new Date();
      const seteDiasAtras = new Date(); seteDiasAtras.setDate(hoje.getDate() - 7);
      
      const ultimosDias = entries.filter(e => { 
        const d = new Date(e.date + 'T12:00:00'); 
        return d >= seteDiasAtras && d <= hoje; 
      });

      if (ultimosDias.length === 0) {
        alert("O campo de batalha está vazio. Preencha o diário nos próximos dias para a IA rastrear seus Kuravas.");
        setIsGeneratingKurava(false);
        return;
      }

      let dossie = `REGISTROS DOS ÚLTIMOS 7 DIAS:\n`;
      ultimosDias.forEach(e => {
        dossie += `[${e.date.split('-').reverse().join('/')}] `;
        if (e.whereIFailed) dossie += `FALHA DECLARADA: ${e.whereIFailed} | `;
        if (e.whatILeftUndone) dossie += `OMISSÃO: ${e.whatILeftUndone} | `;
        if (e.freeEpilogue) dossie += `TEXTO LIVRE: ${e.freeEpilogue} | `;
        dossie += `\n`;
      });

      const prompt = `Você é um Instrutor Filosófico analisando o diário de um discípulo. 
      Sua missão é identificar o "Kurava da Semana" (defeito dominante) e convocar o "Pandava" (virtude).
      ALÉM DISSO, você deve gerar 10 "Ações de Foro Íntimo" altamente específicas para este aluno.
      
      Crie armadilhas morais, "falsas virtudes" (ações que parecem boas mas são fugas, ex: "organizei a mesa para adiar o trabalho"), e vitórias silenciosas baseadas no texto dele.

      DADOS CRUZADOS DOS ÚLTIMOS 7 DIAS:
      ${dossie}

      Retorne ESTRITAMENTE um objeto JSON válido com estas chaves:
      "kurava": "Nome do defeito/vício (1 ou 2 palavras)",
      "pandava": "A Virtude exata para combatê-lo",
      "diagnostico": "Explique de forma fria onde esse Kurava se escondeu nas respostas.",
      "estrategia": "Ação prática de 1 linha.",
      "acoesForoIntimo": [
        { "id": 1, "text": "Frase da ação em primeira pessoa (ex: Senti raiva e segurei a língua)", "value": 15, "type": "positive" },
        { "id": 2, "text": "Frase da ação (ex: Gastei horas lendo teoria para não agir)", "value": -15, "type": "negative" }
        // ... Gere exatamente 10 itens (valores de -20 a +20).
      ]
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) 
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);
      setKuravaData(parsedData);

      // Salva no banco de dados para não perder ao atualizar a página
      await setDoc(doc(db, 'fvData', user.uid), { kuravaData: { ...parsedData, lastUpdate: new Date().toISOString() }, kuravaEnabled: true }, { merge: true });

    } catch (error) { 
      console.error(error); 
      alert("Erro ao invocar a auditoria de Kurukshetra."); 
    } finally { 
      setIsGeneratingKurava(false); 
    }
  };

  // --- GATILHO AUTOMÁTICO DO KURUKSCHETRA (CICLO DE 7 DIAS) ---
  useEffect(() => {
    // A MÁGICA ESTÁ AQUI: isCloudDataLoaded impede que ele dispare antes do Firebase!
    if (user && !loading && isCloudDataLoaded && entries.length >= 3 && kuravaEnabled) {
      
      const verificarEGerarKurava = async () => {
        // COMEÇA FALSO! A IA é proibida de rodar, a menos que as regras de tempo mudem isso.
        let precisaAtualizar = false; 

        if (!kuravaData) {
          // O Firebase terminou de buscar. Se REALMENTE vier vazio, aí sim geramos.
          precisaAtualizar = true;
        } else if (kuravaData.lastUpdate) {
          // Se já existe, calculamos a idade matemática
          const dataUltimoUpdate = new Date(kuravaData.lastUpdate);
          const hoje = new Date();
          
          const diffEmMilissegundos = hoje - dataUltimoUpdate;
          const diffEmDias = diffEmMilissegundos / (1000 * 60 * 60 * 24);

          // Venceu o prazo de 7 dias?
          if (diffEmDias >= 7) {
            precisaAtualizar = true;
          }
        }

        // Trava de segurança dupla para não rodar duas vezes seguidas
        if (precisaAtualizar && !isGeneratingKurava) {
          console.log("Invocando Oráculo: Novo ciclo semanal do Kurava iniciado...");
          await generateKuravaAnalysis();
        }
      };

      verificarEGerarKurava();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isCloudDataLoaded, entries.length, kuravaEnabled]);

  const generateAiGoals = async () => {
    if (!user) return;
    if (!aiConsent) { alert("Para gerar missões, autorize o uso da IA no menu de 'Opções > Configurações'."); return; }
    setIsGeneratingGoals(true);

    try {
      const prompt = `Você é um Mentor Filosófico e Estrategista Comportamental.
      Analise a Visão de Longo Prazo e as Metas Anuais do aluno, e cruze isso com suas falhas recentes (Guarda Baixada) extraídas do seu autoexame.
      
      Sonhos (Virtudes a Desenvolver): ${virtueGoals.map(g => g.text).join(' | ') || 'Não definidas'}
      Projetos (Ações no Mundo): ${projectGoals.map(g => g.text).join(' | ') || 'Não definidos'}
      Onde a Guarda Baixou (Fraquezas recentes): ${aiGuarda || 'Nenhuma fraqueza registrada ainda'}
      
      Crie 3 "Missões de Ciclo" (metas práticas de 15 dias, focadas na raiz do problema) para forçar o aluno a alinhar suas ações aos seus objetivos.

      REGRAS DE SEGURANÇA E ÉTICA (MUITO IMPORTANTE):
      - NUNCA sugira restrições alimentares (como cortar açúcar, jejuns), alterações drásticas de sono ou exercícios físicos intensos. 
      - Mantenha os desafios estritamente no campo filosófico, comportamental, de estudos, meditação, reflexão ou organização pessoal e de tempo.

      Retorne ESTRITAMENTE um objeto JSON válido:
      {
        "conselho": "Um parágrafo curto e direto de choque de realidade filosófica cruzando o que ele quer com o que ele tem feito.",
        "missoes": [
          { "titulo": "Nome da Missão", "descricao": "O que fazer exatamente" },
          { "titulo": "Nome da Missão", "descricao": "O que fazer exatamente" },
          { "titulo": "Nome da Missão", "descricao": "O que fazer exatamente" }
        ]
      }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) 
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);
      setAiSuggestedGoals(parsedData);

      await setDoc(doc(db, 'longTermGoals', user.uid), { 
        virtueGoals, projectGoals, aiSuggestedGoals: parsedData, updatedAt: Timestamp.now() 
      }, { merge: true });

    } catch (error) { 
      console.error(error); 
      alert("Erro ao consultar a IA."); 
    } finally { 
      setIsGeneratingGoals(false); 
    }
  };

  // --- MÓDULO GDVE ---
  const saveGdveTasksToDB = async (tasks) => {
    if (user) {
      try { await setDoc(doc(db, 'fvData', user.uid), { gdveTasks: tasks }, { merge: true }); } 
      catch(e) { console.error("Erro ao salvar tarefas GDVE", e); }
    }
  };

  const addGdveTask = () => {
    if (!newGdveTaskName.trim()) return;
    const taskData = {
      id: editingGdveTaskId || `gdve_${Date.now()}`,
      name: newGdveTaskName.trim(),
      target: parseInt(newGdveTaskTarget) || 1,
      isCycle: newGdveTaskIsCycle
    };
    
    const newTasks = editingGdveTaskId 
      ? fvGdveTasks.map(t => t.id === editingGdveTaskId ? taskData : t)
      : [...fvGdveTasks, taskData];
      
    setFvGdveTasks(newTasks);
    setNewGdveTaskName('');
    setNewGdveTaskTarget(1);
    setNewGdveTaskIsCycle(false);
    setEditingGdveTaskId(null);
    saveGdveTasksToDB(newTasks);
  };

  const startEditingGdveTask = (task) => {
    setEditingGdveTaskId(task.id);
    setNewGdveTaskName(task.name);
    setNewGdveTaskTarget(task.target || 1);
    setNewGdveTaskIsCycle(task.isCycle || false);
  };

  const removeGdveTask = (id) => {
    const newTasks = fvGdveTasks.filter(t => t.id !== id);
    setFvGdveTasks(newTasks);
    saveGdveTasksToDB(newTasks);
  };

  const toggleGdveTask = async (task) => {
    if (task.isCycle) {
      // Tarefas de Ciclo: Ficam salvas globalmente e não zeram todo dia
      const newStatus = { ...fvGdveCycleStatus, [task.id]: !fvGdveCycleStatus[task.id] };
      setFvGdveCycleStatus(newStatus);
      if (user) { await setDoc(doc(db, 'fvData', user.uid), { gdveCycleStatus: newStatus }, { merge: true }); }
    } else {
      // Tarefas Diárias (Contador Numérico ou Checkbox)
      let currentVal = fvDaily.gdveTasksStatus?.[task.id] || 0;
      if (typeof currentVal === 'boolean') currentVal = currentVal ? 1 : 0; // Prevenção para dados antigos
      
      let newVal;
      if (task.target > 1) {
         newVal = currentVal + 1;
         if (newVal > task.target) newVal = 0; // Ao chegar no limite, o clique seguinte zera
      } else {
         newVal = currentVal ? 0 : 1; // 0 ou 1 normal
      }
      
      const newFvDaily = { ...fvDaily, gdveTasksStatus: { ...fvDaily.gdveTasksStatus, [task.id]: newVal } };
      setFvDaily(newFvDaily);
      if (user) {
        await setDoc(doc(db, 'entries', `${user.uid}_${selectedDate}`), { fvDaily: newFvDaily }, { merge: true });
        await loadAllEntries(user.uid);
      }
    }
  };

  const registerGdveAttendance = async () => {
    const isAttending = !fvDaily.gdveAttendance;
    const newFvDaily = { ...fvDaily, gdveAttendance: isAttending };
    setFvDaily(newFvDaily);
    
    // A Mágica dos 15 dias e da Limpeza do Ciclo
    if (isAttending) {
      const confirmRecalc = window.confirm("Deseja marcar a próxima reunião para 15 dias APÓS ESTA DATA? (Isso também vai zerar as suas tarefas de 'Ciclo' pendentes).");
      if (confirmRecalc) {
         // 1. Calcula os 15 dias a partir da data que o usuário selecionou na tela!
         const currentDate = new Date(selectedDate + 'T12:00:00');
         currentDate.setDate(currentDate.getDate() + 15);
         
         // 2. Preserva a hora da reunião anterior (ou usa 20:00 como padrão)
         let nextHour = '20'; let nextMinute = '00';
         if (fvGdveReuniao) {
            const prevDate = new Date(fvGdveReuniao);
            if (!isNaN(prevDate.getTime())) {
              nextHour = String(prevDate.getHours()).padStart(2, '0');
              nextMinute = String(prevDate.getMinutes()).padStart(2, '0');
            }
         }
         
         const nextYear = currentDate.getFullYear();
         const nextMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
         const nextDay = String(currentDate.getDate()).padStart(2, '0');
         
         const nextDateStr = `${nextYear}-${nextMonth}-${nextDay}T${nextHour}:${nextMinute}`;
         setFvGdveReuniao(nextDateStr);
         setFvGdveCycleStatus({}); // Limpa as tarefas de ciclo!
         
         if(user){ await setDoc(doc(db, 'fvData', user.uid), { gdveReuniao: nextDateStr, gdveCycleStatus: {} }, { merge: true }); }
      }
    }

    if (user) {
      await setDoc(doc(db, 'entries', `${user.uid}_${selectedDate}`), { fvDaily: newFvDaily }, { merge: true });
      await loadAllEntries(user.uid);
    }
  };
  // --------------------

  const saveFvPlanning = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'fvData', user.uid);
      await setDoc(docRef, { 
        lastCartaDate: fvLastCartaDate, 
        nextCartaDate: fvNextCartaDate,
        gdveReuniao: fvGdveReuniao,
        fvMasterName: fvMasterName,
        fvLastMeetingDate: fvLastMeetingDate
      }, { merge: true });
      alert("Planejamento e dados do Instrutor salvos com sucesso!");
    } catch (error) { console.error("Erro ao salvar datas FV:", error); }
  };

  const generateTechnicalSynthesis = async () => {
    if (!user) return;
    if (!aiConsent) { alert("Para auditar seus dados, autorize o uso da IA no menu de 'Opções > Configurações'."); return; }
    setIsGeneratingSynthesis(true);

    try {
      const hoje = new Date();
      const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(hoje.getDate() - 30);
      const sessentaDiasAtras = new Date(); sessentaDiasAtras.setDate(hoje.getDate() - 60);

      const cicloAtual = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= trintaDiasAtras && d <= hoje; });
      const cicloAnterior = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= sessentaDiasAtras && d < trintaDiasAtras; });
      
      const epilogosAtual = cicloAtual.filter(e => e.eveningDone);
      const evasaoVazia = epilogosAtual.filter(e => !e.whereIFailed && !e.whatIDidWell && !e.whatILeftUndone && !e.freeEpilogue).length;
      const evasaoParcial = epilogosAtual.filter(e => (e.whereIFailed || e.whatIDidWell || e.whatILeftUndone) && (!e.whereIFailed || !e.whatIDidWell || !e.whatILeftUndone)).length;

      let dossie = `DADOS ESTATÍSTICOS DO USUÁRIO:\n\n`;
      dossie += `[CICLO ANTERIOR: Dias -60 a -31]\n- Preenchimentos: ${cicloAnterior.length}\n\n`;

      dossie += `[CICLO ATUAL: Últimos 30 dias]\n- Preenchimentos: ${cicloAtual.length}\n`;
      dossie += `- COMPORTAMENTO DE AUTOEXAME: Dos ${epilogosAtual.length} epílogos, ${evasaoVazia} foram deixados em branco e ${evasaoParcial} foram parciais.\n`;
      dossie += `- ONDE FALHOU: ${cicloAtual.filter(e => e.whereIFailed).map(e => e.whereIFailed).join(' | ')}\n`;
      dossie += `- O QUE FEZ BEM: ${cicloAtual.filter(e => e.whatIDidWell).map(e => e.whatIDidWell).join(' | ')}\n`;
      dossie += `- O QUE DEIXOU DE FAZER: ${cicloAtual.filter(e => e.whatILeftUndone).map(e => e.whatILeftUndone).join(' | ')}\n`;
      dossie += `- TEXTO LIVRE: ${cicloAtual.filter(e => e.freeEpilogue).map(e => e.freeEpilogue).join(' | ')}\n`;

      const prompt = `Você é um Analista de Dados. Retorne ESTRITAMENTE um objeto JSON válido (sem formatação Markdown e sem blocos de código).

      REGRAS DE CONTEÚDO:
      - NÃO dê conselhos. Aja como um auditor imparcial.
      - Analise simultaneamente os campos estruturados (Falhas, Acertos, Omissões) e cruze-os com as informações contidas no "TEXTO LIVRE".

      O JSON deve conter EXATAMENTE as seguintes chaves:
      "guardaBaixou": Uma síntese fria dos padrões onde o usuário falhou ou demonstrou fraqueza (máximo 3 linhas).
      "conquistas": Uma síntese técnica dos padrões de acerto, virtudes executadas e sucessos mapeados (máximo 3 linhas).
      "investigacoes": Um mapeamento de hipóteses, percepções, suspeitas e dúvidas que o usuário expressou predominantemente no Texto Livre (máximo 4 linhas).
      "sinteseGeral": Um relatório de 2 parágrafos: O primeiro avaliando o comportamento de evasão/completude do preenchimento e comparando com o ciclo anterior; o segundo sugerindo 2 perguntas técnicas para auditoria com um instrutor presencial.

      DADOS:
      ${dossie}`;

      // Configuração forçando o Gemini a cuspir JSON puro
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }) 
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      // Parse do JSON recebido
      const rawText = data.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(rawText);
      const dataAtual = new Date().toISOString();

      // Salva nos estados
      setAiGuarda(parsedData.guardaBaixou);
      setAiConquistas(parsedData.conquistas);
      setAiInvestigacoes(parsedData.investigacoes);
      setTechnicalSynthesis(parsedData.sinteseGeral);

      // Salva no Firebase
      await setDoc(doc(db, 'fvData', user.uid), { 
        technicalSynthesis: parsedData.sinteseGeral, 
        aiGuarda: parsedData.guardaBaixou,
        aiConquistas: parsedData.conquistas,
        aiInvestigacoes: parsedData.investigacoes,
        technicalSynthesisDate: dataAtual 
      }, { merge: true });

    } catch (error) { 
      console.error(error); 
      alert("Erro ao gerar síntese estruturada. Tente novamente."); 
    } finally { 
      setIsGeneratingSynthesis(false); 
    }
  };

  const generateDiscipularSynthesis = async () => {
    if (!user) return;
    if (!aiConsent) { alert("Para gerar relatórios avançados, autorize o uso da IA no menu de 'Opções > Configurações'."); return; }
    setIsGeneratingDiscSync(true);

    // ==========================================
  // FUNÇÃO MESTRE: FEEDBACK DA IA
  // ==========================================
  const submitSynthesisFeedback = async (tipoRelatorio) => {
    if (feedbackRating === 0) return alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
    setIsSubmittingFeedback(true); // LIGA O MODO ENVIANDO
    
    try {
      const feedbackRef = doc(collection(db, 'synthesisFeedback')); 
      await setDoc(feedbackRef, {
        tipo: tipoRelatorio,
        nota: feedbackRating,
        comentario: feedbackText || "Sem comentário escrito.",
        data: new Date().toISOString(),
        userId: "Anônimo" 
      });
      
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setFeedbackRating(0);
        setFeedbackText('');
        setFeedbackSubmitted(false);
      }, 5000); 
      
    } catch (error) {
      console.error("Erro ao enviar avaliação:", error);
      alert("Erro ao enviar avaliação. Verifique as permissões do Firebase.");
    } finally {
      setIsSubmittingFeedback(false); // DESLIGA O MODO ENVIANDO
    }
  };
  

    try {
      // 1. Coleta e Divisão do Tempo (60 dias)
      const hoje = new Date();
      const trintaDiasAtras = new Date(); 
      trintaDiasAtras.setDate(hoje.getDate() - 30);
      const sessentaDiasAtras = new Date(); 
      sessentaDiasAtras.setDate(hoje.getDate() - 60);

      const cicloAtual = entries.filter(e => {
        const d = new Date(e.date + 'T12:00:00');
        return d >= trintaDiasAtras && d <= hoje;
      });
      const cicloAnterior = entries.filter(e => {
        const d = new Date(e.date + 'T12:00:00');
        return d >= sessentaDiasAtras && d < trintaDiasAtras;
      });

      // Função auxiliar para somar práticas FV realizadas
      const countPractices = (ciclo) => {
        let total = 0;
        ciclo.forEach(e => {
          if(e.fvDaily && e.fvDaily.praticas) {
            total += Object.values(e.fvDaily.praticas).filter(v => v === true).length;
          }
        });
        return total;
      };
      
      // 2. Monta o Dossiê Estatístico Profundo (FV)
      let dossie = `DADOS ESTATÍSTICOS DO DISCIPULADO (FV):\n\n`;
      dossie += `[CICLO ANTERIOR: Dias -60 a -31]\n`;
      dossie += `- Preenchimentos do diário geral: ${cicloAnterior.length}\n`;
      dossie += `- Total de Práticas FV realizadas: ${countPractices(cicloAnterior)}\n`;
      dossie += `- Falhas relatadas: ${cicloAnterior.filter(e => e.whereIFailed).map(e => e.whereIFailed).join(' | ')}\n\n`;

      dossie += `[CICLO ATUAL: Últimos 30 dias]\n`;
      dossie += `- Preenchimentos do diário geral: ${cicloAtual.length}\n`;
      dossie += `- Total de Práticas FV realizadas: ${countPractices(cicloAtual)}\n`;
      dossie += `- Streak ininterrupto atual de práticas ocultas: ${fvTasksStreak} dias\n`;
      dossie += `- Falhas relatadas: ${cicloAtual.filter(e => e.whereIFailed).map(e => e.whereIFailed).join(' | ')}\n`;

      const fvTextsItem1 = cicloAtual.filter(e => e.fvDaily && e.fvDaily.item1).map(e => e.fvDaily.item1).join(' | ');
      const fvTextsItem6 = cicloAtual.filter(e => e.fvDaily && e.fvDaily.item6).map(e => e.fvDaily.item6).join(' | ');
      dossie += `- Relatos FV de "Varrer por Dentro" (Item 1): ${fvTextsItem1}\n`;
      dossie += `- Relatos FV de "Vícios" (Item 6): ${fvTextsItem6}\n`;

      const termoMestre = fvMasterName ? `seu Mestre/Instrutor (${fvMasterName})` : "seu Mestre/Instrutor";

      // 3. O Prompt Profundo (Cruzamento de Dados)
      const prompt = `Você é um Analista de Dados e Auditor comportamental avançado. Retorne ESTRITAMENTE um objeto JSON válido (sem formatação Markdown e sem blocos de código).
      
      REGRAS DE CONTEÚDO:
      - NÃO dê conselhos. Seja frio, analítico e imparcial.
      - Seu principal objetivo é o CRUZAMENTO DE DADOS. Não apenas liste falhas, mas cruze-as com o comportamento prático. Exemplo: "A queda nas práticas de meditação acompanhou o aumento de relatos de irritabilidade".

      O JSON deve conter EXATAMENTE as seguintes chaves:
      "metricas": Uma síntese técnica cruzando a variação das "Práticas FV" com a variação dos "Preenchimentos" do Ciclo Atual vs Anterior. Comente também sobre o nível de engajamento oculto (Streak) (máximo 3 linhas).
      "auditoria": O mapeamento de "Onde a Guarda Baixou" vs "Conquistas Forjadas". Identifique os gatilhos recorrentes de falha e os padrões de êxito (máximo 4 linhas).
      "lexical": A varredura profunda dos "Itens 1 e 6" (Varrer por Dentro e Vícios) cruzada com o Texto Livre. Isole padrões de causalidade e hipóteses de auto-investigação do usuário (máximo 4 linhas).
      "sinteseGeral": Um relatório final dividido em dois parágrafos. O primeiro com a conclusão técnica sobre a 'Completude do Autoexame' do aluno. O segundo formulando 2 perguntas cirúrgicas e baseadas estritamente em dados (sem tom de conselho) para o encontro presencial com ${termoMestre}.

      DADOS DESTE CICLO:
      ${dossie}`;

      // 4. Chamada da API forçando JSON
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      // 5. Salvar resultado nas 4 gavetas
      const rawText = data.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(rawText);
      const dataAtual = new Date().toISOString();

      setFvAiMetricas(parsedData.metricas);
      setFvAiAuditoria(parsedData.auditoria);
      setFvAiLexical(parsedData.lexical);
      setDiscipularSynthesis(parsedData.sinteseGeral);

      const docRef = doc(db, 'fvData', user.uid);
      await setDoc(docRef, { 
        discipularSynthesis: parsedData.sinteseGeral,
        fvAiMetricas: parsedData.metricas,
        fvAiAuditoria: parsedData.auditoria,
        fvAiLexical: parsedData.lexical,
        technicalSynthesisDate: dataAtual
      }, { merge: true });

    } catch (error) { 
      console.error("Erro no Relatório Discipular:", error); 
      alert("Erro ao gerar relatório discipular."); 
    } finally { 
      setIsGeneratingDiscSync(false); 
    }
  };

  const saveFvTexts = async () => {
    if (user) {
      const todayKey = selectedDate;
      try {
        const payload = {
          userId: user.uid,
          date: todayKey,
          fvDaily: fvDaily, 
          fvTextsTimestamp: Timestamp.now()
        };

        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), payload, { merge: true }); 
        
        await loadAllEntries(user.uid); 
        
        alert('✅ Reflexões da Carta de Degrau salvas com sucesso!');
      } catch (error) { console.error(error); alert('Erro ao salvar os textos.'); }
    }
  };

  const saveFvPractices = async () => {
    if (user) {
      const todayKey = selectedDate;
      try {
        const payload = {
          userId: user.uid,
          date: todayKey,
          fvDaily: fvDaily, 
          fvPracticesTimestamp: Timestamp.now()
        };

        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), payload, { merge: true }); 
        
        await loadAllEntries(user.uid); 
        
        alert('✅ Práticas Internas salvas com sucesso!');
      } catch (error) { console.error(error); alert('Erro ao salvar as práticas.'); }
    }
  };

  const handleFvDailyTextChange = (key, value) => {
    setFvDaily(prev => ({ ...prev, [key]: value }));
  };

  const handleFvDailyPracticeChange = (key, value) => {
    setFvDaily(prev => ({ ...prev, praticas: { ...prev.praticas, [key]: value } }));
  };

  const confirmImmersivePractice = async (key) => {
    const newFvDaily = {
      ...fvDaily,
      praticas: { ...fvDaily.praticas, [key]: true }
    };
    setFvDaily(newFvDaily); 
    setIsPracticeActive(false);
    exitFullScreen();

    if (user) {
      const todayKey = selectedDate;
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          fvDaily: newFvDaily
        }, { merge: true });
        await loadAllEntries(user.uid); 
        // Feedback visual para o usuário saber que salvou no FV
        alert('✅ Prática concluída e registrada com sucesso no seu Diário (FV)!');
      } catch (error) { console.error("Erro ao salvar prática:", error); }
    }
  };

  const confirmTemploPractice = async () => {
    const newFvDaily = {
      ...fvDaily,
      praticas: { ...fvDaily.praticas, ...temploSelections }
    };
    setFvDaily(newFvDaily);
    setIsPracticeActive(false);
    exitFullScreen();

    if (user) {
      const todayKey = selectedDate;
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          fvDaily: newFvDaily
        }, { merge: true });
        await loadAllEntries(user.uid);
      } catch (error) {}
    }
  };

  const deleteEntry = async (dateKey) => {
    if (!window.confirm('Deseja realmente excluir este dia?')) return;
    try {
      await deleteDoc(doc(db, 'entries', `${user.uid}_${dateKey}`));
      setEntries(entries.filter(e => e.date !== dateKey));
    } catch (error) { alert('Erro ao excluir entrada.'); }
  };

  const exportToCSV = () => {
    if (entries.length === 0) { alert('Não há entradas para exportar'); return; }
    
    // Cabeçalhos Base
    const headers = ['Data', 'Fez Prólogo', 'Virtude', 'Compromisso', 'Onde Errei', 'O Que Fiz Bem', 'O Que Deixei de Fazer'];
    
    // Se o modo FV estiver ativado, adicionamos as colunas de 1 a 7 e as práticas
    if (fvUnlocked) {
      headers.push('FV: 1-Varrer', 'FV: 2-Matéria', 'FV: 3e4-Trabalho', 'FV: 5-Tempo', 'FV: 6-Vícios', 'FV: 7-Virtudes', 'FV: Voluntariado', 'FV: Aula Assistida', 'FV: Aula Ministrada', 'FV: Práticas Realizadas');
    }

    const rows = entries.map(entry => {
      const row = [
        entry.date, entry.didMorning ? 'Sim' : 'Não', entry.virtue || '', entry.intention || '',
        entry.whereIFailed || '', entry.whatIDidWell || '', entry.whatILeftUndone || ''
      ];

      // Puxando os dados FV daquele dia (se existirem)
      if (fvUnlocked) {
        const fv = entry.fvDaily || {};
        let praticasText = '';
        
        if (fv.praticas) {
          const fvLabels = { tratack: 'Tratak', recitarHonra: 'Código de Dignidade', recitar7Fases: '7 Fases', camara: 'Câmara', porta: 'Porta', patioAberto: 'Pátio Aberto', patioColunas: 'Pátio Colunas', santuario: 'Santuário' };
          praticasText = Object.entries(fv.praticas).filter(([_, feito]) => feito).map(([key]) => fvLabels[key] || key).join(' + ');
        }

        row.push(
          fv.item1 || '', fv.item2 || '', fv.item34 || '', fv.item5 || '', 
          fv.item6 || '', fv.item7 || '', fv.horasVoluntariado || '', fv.horasAulaAssistida || '', fv.horasAulaMinistrada || '', praticasText
        );
      }
      return row;
    });

    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = fvUnlocked ? `relatorio-fv-${getTodayKey()}.csv` : `diario-filosofico-${getTodayKey()}.csv`; 
    link.click();
  };

  const exportFvReportTXT = () => {
    if (entries.length === 0) { alert('Não há entradas para exportar'); return; }
    
    const totals = getFvMonthlyTotals();
    let txtContent = `====================================================\n`;
    txtContent += `      RELATÓRIO DE PREPARAÇÃO - CARTA DE DEGRAU\n`;
    txtContent += `      Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n`;
    txtContent += `----------------------------------------------------\n`;
    txtContent += ` ACUMULADO DO CICLO (ÚLTIMOS 30 DIAS):\n`;
    txtContent += ` - Voluntariado: ${totals.voluntariado}\n`;
    txtContent += ` - Aulas Assistidas: ${totals.assistida}\n`;
    txtContent += ` - Aulas Ministradas: ${totals.ministrada}\n`;
    txtContent += `====================================================\n\n`;
    
    const reversedEntries = [...entries].reverse();
    let hasData = false;

    reversedEntries.forEach(entry => {
      if (entry.fvDaily) {
        const fv = entry.fvDaily;
        const hasTextData = fv.item1 || fv.item2 || fv.item34 || fv.item5 || fv.item6 || fv.item7;
        
        if (hasTextData) {
          hasData = true;
          txtContent += `----------------------------------------------------\n`;
          txtContent += `DATA: ${new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}\n`;
          txtContent += `----------------------------------------------------\n`;
          
          if (fv.item1) txtContent += `[1] Varrer por Dentro:\n${fv.item1}\n\n`;
          if (fv.item2) txtContent += `[2] Leis da Matéria:\n${fv.item2}\n\n`;
          if (fv.item34) txtContent += `[3 e 4] Trabalho Ordenado e Eficaz:\n${fv.item34}\n\n`;
          if (fv.item5) txtContent += `[5] Economia de Tempo e Energia:\n${fv.item5}\n\n`;
          if (fv.item6) txtContent += `[6] Os Vícios:\n${fv.item6}\n\n`;
          if (fv.item7) txtContent += `[7] Virtudes (Perseverança e Constância):\n${fv.item7}\n\n`;
          
          if (fv.horasVoluntariado || fv.horasAulaAssistida || fv.horasAulaMinistrada) {
            txtContent += `[Registro de Horas]\nHoras de Voluntariado: ${fv.horasVoluntariado || '--'} | Aula Assistida: ${fv.horasAulaAssistida || '--'} | Aula Ministrada: ${fv.horasAulaMinistrada || '--'}\n\n`;
          }
          txtContent += `\n\n`;
        }
      }
    });

    if (!hasData) {
      alert('Você ainda não tem textos preenchidos nos itens FV para gerar o relatório.');
      return;
    }

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `Borracha_Carta_Degrau_${getTodayKey()}.txt`; 
    link.click();
  };

  const importDiary = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        if (file.name.endsWith('.csv')) await importFromCSV(content);
        else if (file.name.endsWith('.json')) await importFromJSON(content);
        else if (file.name.endsWith('.txt')) await importFromTXT(content);
        else alert('Formato não suportado. Use CSV, JSON ou TXT.');
      } catch (error) { alert('Erro ao importar arquivo.'); }
    };
    reader.readAsText(file);
  };

  const importFromCSV = async (content) => {
    const lines = content.split('\n').slice(1);
    let imported = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').replace(/""/g, '"'));
      if (parts.length < 6) continue;
      const [date, didMorningStr, virtue, intention, whereIFailed, whatIDidWell, whatILeftUndone] = parts;
      const entry = { userId: user.uid, date, didMorning: didMorningStr === 'Sim', virtue, intention, whereIFailed, whatIDidWell, whatILeftUndone, morningDone: true, eveningDone: true, importedAt: Timestamp.now() };
      try { await setDoc(doc(db, 'entries', `${user.uid}_${date}`), entry); imported++; } catch (error) { console.error(`Erro ao importar ${date}`); }
    }
    await loadAllEntries(user.uid); alert(`✅ ${imported} entradas importadas com sucesso!`);
  };

  const importFromJSON = async (content) => {
    const data = JSON.parse(content);
    let imported = 0;
    for (const entry of data) {
      if (!entry.date) continue;
      const newEntry = { ...entry, userId: user.uid, importedAt: Timestamp.now() };
      try { await setDoc(doc(db, 'entries', `${user.uid}_${entry.date}`), newEntry); imported++; } catch (error) { console.error(`Erro ao importar ${entry.date}`); }
    }
    await loadAllEntries(user.uid); alert(`✅ ${imported} entradas importadas com sucesso!`);
  };

  const importFromTXT = async (content) => {
    const entriesText = content.split('---');
    let imported = 0;
    for (const entryText of entriesText) {
      if (!entryText.trim()) continue;
      const lines = entryText.trim().split('\n');
      const entry = { userId: user.uid, date: getTodayKey(), whereIFailed: '', whatIDidWell: '', whatILeftUndone: '', morningDone: false, eveningDone: true, importedAt: Timestamp.now() };
      lines.forEach(line => {
        if (line.startsWith('Data:')) entry.date = line.replace('Data:', '').trim();
        if (line.startsWith('Virtude:')) entry.virtue = line.replace('Virtude:', '').trim();
        if (line.startsWith('Onde errei:')) entry.whereIFailed = line.replace('Onde errei:', '').trim();
        if (line.startsWith('O que fiz bem:')) entry.whatIDidWell = line.replace('O que fiz bem:', '').trim();
        if (line.startsWith('O que deixei:')) entry.whatILeftUndone = line.replace('O que deixei:', '').trim();
      });
      if (entry.date && entry.whereIFailed) {
        try { await setDoc(doc(db, 'entries', `${user.uid}_${entry.date}`), entry); imported++; } catch (error) { console.error(`Erro ao importar ${entry.date}`); }
      }
    }
    await loadAllEntries(user.uid); alert(`✅ ${imported} entradas importadas com sucesso!`);
  };

  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } 
    catch (err) { setError('Erro ao fazer login com o Google. Verifique se ativou no Firebase.'); }
  };

  const handleAuth = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } 
      else {
        if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres'); return; }
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail(''); setPassword('');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Este e-mail já está em uso');
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') setError('E-mail ou senha incorretos');
      else if (err.code === 'auth/invalid-email') setError('E-mail inválido');
      else setError('Erro ao autenticar. Tente novamente.');
    }
  };

  const handleLogout = async () => { 
    if (user && fvUnlocked) {
      try { await updateDoc(doc(db, 'users', user.uid), { fvUnlocked: false }); } catch(err) {}
    }
    setFvUnlocked(false); 
    await signOut(auth); 
    setView('today'); 
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (user) { await updateDoc(doc(db, 'users', user.uid), { theme: newTheme }); }
  };

  const saveNotificationTimes = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { 
          morningTime, 
          eveningTime 
        });
        alert('✅ Configurações atualizadas com sucesso!');
        setShowSettingsModal(false);
      } catch (error) {
        console.error("Erro ao salvar", error);
        alert('Erro ao salvar horários.');
      }
    }
  };

  const filteredEntries = entries.filter(entry =>
    (entry.whereIFailed && entry.whereIFailed.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.whatIDidWell && entry.whatIDidWell.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.whatILeftUndone && entry.whatILeftUndone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.virtue && entry.virtue.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.freeEpilogue && entry.freeEpilogue.toLowerCase().includes(searchTerm.toLowerCase())) 
  );

  const isDark = theme === 'dark';
  const streakInfo = getStreakInfo(streak);
  const StreakIcon = streakInfo.current.icon; 
  const getFvMonthlyTotals = () => {
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    const cicloEntries = entries.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= trintaDiasAtras && d <= hoje;
    });

    const sumMinutes = (key) => cicloEntries.reduce((acc, curr) => {
      if (curr.fvDaily && curr.fvDaily[key]) {
        const [h, m] = curr.fvDaily[key].split(':').map(Number);
        return acc + (h * 60 + m);
      }
      return acc;
    }, 0);

    const formatTime = (totalMin) => {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return `${h}h ${String(m).padStart(2, '0')}m`;
    };

    return {
      voluntariado: formatTime(sumMinutes('horasVoluntariado')),
      assistida: formatTime(sumMinutes('horasAulaAssistida')),
      ministrada: formatTime(sumMinutes('horasAulaMinistrada'))
    };
  };

  // --- O MOTOR DO BALÃO (ELEVAÇÃO DE CONSCIÊNCIA) ---
  

  // --- MOTOR DA CONSCIÊNCIA (FÍSICA DO BALÃO) ---
  const calculateConsciousness = () => {
    let altitude = 40; // Base: A inércia natural puxa pra baixo

    // 1. O Peso do Passado (Omissões)
    const ultimosDias = entries.slice(0, 3);
    ultimosDias.forEach(e => {
      if (e.whereIFailed) altitude -= 5;
      if (e.whatILeftUndone) altitude -= 3;
      if (!e.didMorning) altitude -= 5;
    });

    // 2. O Kurava da Semana (A sombra ativa)
    if (kuravaData) altitude -= 15; 

    // 3. O Fogo da Vontade (Hábito empurra para cima)
    altitude += Math.min(streak * 2, 20); // Constância
    altitude += Math.min(fvTasksStreak * 3, 20); // Práticas FV

    // 4. O Calor do Dia (Ações)
    if (morningDone) altitude += 10;
    const completedTasksCount = getTasksForToday().filter(t => todayTasksStatus[t.id]).length;
    altitude += (completedTasksCount * 4); 

    // 5. A Lista Renovável (Ações Imediatas de Foro Íntimo)
    altitude += manualAltitudeModifier;

    return Math.max(0, Math.min(100, altitude));
  };
  
  const altitude = calculateConsciousness();

  const [balloonActions, setBalloonActions] = useState(null);
  const [isGeneratingBalloon, setIsGeneratingBalloon] = useState(false);

  // --- INTELIGÊNCIA DIRETA DO BALÃO ---
  const generateBalloonActions = async () => {
    if (!user) return;
    if (!aiConsent) { alert("Para invocar o Oráculo, autorize o uso da IA no menu de 'Opções > Configurações'."); return; }
    setIsGeneratingBalloon(true);

    try {
      // Separa o estado de consciência atual (últimas 24h) dos hábitos de longo prazo (30 dias)
      const registroHoje = entries.slice(0, 1);
      const historico30Dias = entries.slice(1, 30);

      let dossie24h = `REGISTROS DAS ÚLTIMAS 24 HORAS (Estado atual da mente):\n`;
      registroHoje.forEach(e => {
        if (e.whereIFailed) dossie24h += `FALHA: ${e.whereIFailed} | `;
        if (e.whatILeftUndone) dossie24h += `OMISSÃO: ${e.whatILeftUndone} | `;
        if (e.freeEpilogue) dossie24h += `TEXTO LIVRE: ${e.freeEpilogue} | `;
      });

      let dossie30Dias = `PADRÕES DOS ÚLTIMOS 30 DIAS:\n`;
      historico30Dias.forEach(e => {
        if (e.whereIFailed) dossie30Dias += `FALHA: ${e.whereIFailed} | `;
        if (e.whatILeftUndone) dossie30Dias += `OMISSÃO: ${e.whatILeftUndone} | `;
      });

      const prompt = `Você é um mentor filosófico. O Balão de Consciência avalia o estado ATUAL do discípulo.
      
      ${dossie24h}
      
      ${dossie30Dias}
      
      Gere um array JSON puro com 10 "Ações de Foro Íntimo" misturando a realidade dele com vícios humanos gerais.
      
      REGRAS RÍGIDAS DE COMPORTAMENTO:
      1. COMPOSIÇÃO DAS 10 AÇÕES: 
         - Crie ações baseadas no estado das ÚLTIMAS 24 HORAS.
         - Crie ações baseadas nos padrões dos ÚLTIMOS 30 DIAS.
         - OBRIGATORIAMENTE adicione "Vícios Universais" que não estão no texto, como: comer mal apenas por prazer, consumir séries/vídeos sem propósito real, achar que precisava de mais descanso do que o necessário, ceder à preguiça, etc.
      2. O COTIDIANO: Transforme eventos únicos em princípios psicológicos, mas cite hábitos diários normais.
      3. SEJA CONCISO: Máximo absoluto de 80 CARACTERES por ação.
      4. NO PASSADO: Use a primeira pessoa, focando na ação de hoje ("Hoje eu...", "Hoje cedi...").
      5. TIPOS DE AÇÕES: Crie falsas virtudes, derrotas silenciosas e vitórias íntimas.

      ESTRUTURA OBRIGATÓRIA (retorne APENAS o array JSON válido):
      [
        { "id": 1, "text": "Hoje consumi séries e vídeos que me divertiram, mas sem propósito real.", "value": -15, "type": "negative" },
        { "id": 2, "text": "Hoje achei que precisava de mais descanso do que nos outros dias e cedi.", "value": -15, "type": "negative" },
        { "id": 3, "text": "Hoje comi algo não saudável apenas pela busca do conforto e prazer.", "value": -15, "type": "negative" }
      ]`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) 
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);
      setBalloonActions(parsedData);
      setConsumedActionIds([]); 
      
      const shuffled = [...parsedData].sort(() => 0.5 - Math.random());
      setDisplayedActions(shuffled.slice(0, 3));
      
      // Salva no banco de dados para não sumir se você atualizar a página
      await setDoc(doc(db, 'fvData', user.uid), { balloonActions: parsedData }, { merge: true });

    } catch (error) { 
      console.error(error); 
      alert("Erro ao invocar o Oráculo para o Balão. Tente novamente."); 
    } finally { 
      setIsGeneratingBalloon(false); 
    }
  };

  const currentActionPool = balloonActions || [];

  useEffect(() => {
    if (showConsciousnessModal && displayedActions.length === 0 && consumedActionIds.length === 0 && currentActionPool.length > 0) {
      const shuffled = [...currentActionPool].sort(() => 0.5 - Math.random());
      setDisplayedActions(shuffled.slice(0, 3));
    }
  }, [showConsciousnessModal, currentActionPool, consumedActionIds.length, displayedActions.length]);

  const replaceAction = (actionIdToRemove) => {
    setConsumedActionIds(prevConsumed => {
      const newConsumed = [...prevConsumed, actionIdToRemove];
      setDisplayedActions(prevDisp => {
        const remaining = prevDisp.filter(a => a.id !== actionIdToRemove);
        const available = currentActionPool.filter(a => !remaining.find(d => d.id === a.id) && !newConsumed.includes(a.id));
        if (available.length > 0) {
          const randomNew = available[Math.floor(Math.random() * available.length)];
          remaining.push(randomNew);
        }
        return remaining;
      });
      return newConsumed;
    });
  };

  
// A função universal que processa a matemática invertida secretamente
  const handleInteraction = (action, multiplier, type) => {
    if (animatingActionId) return; 
    setAnimatingActionId(action.id);
    setAnimatingType(type);
    
    setTimeout(() => {
      // O multiplicador inverte a nota se for "Agi Diferente", ou zera se for "Não Ocorreu"
      setPendingAltitudeModifier(prev => prev + (action.value * multiplier));
      replaceAction(action.id);
      setAnimatingActionId(null);
      setAnimatingType(null);
    }, 450); 
  };

  // O Veredito: Só aplica a nota e move o balão quando o usuário fecha a janela
  const closeConsciousnessModal = () => {
    if (pendingAltitudeModifier !== 0) {
      setManualAltitudeModifier(prev => prev + pendingAltitudeModifier);
      setPendingAltitudeModifier(0); // Zera o cofre para a próxima vez
    }
    setShowConsciousnessModal(false);
  };

  // A Máscara: Só revela o resultado se não houver perguntas E não houver pontos no cofre

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center' }}>
          <BookOpen size={48} />
          <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)', fontFamily: 'Georgia, serif' }}>
        
        {/* CABEÇALHO DA LANDING PAGE */}
        <header style={{ padding: '1.5rem 2rem', background: 'rgba(255, 255, 255, 0.5)', borderBottom: '1px solid rgba(139, 115, 85, 0.2)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BookOpen size={32} color="#8b7355" />
            <h1 style={{ margin: 0, color: '#2c1810', fontSize: '1.5rem', fontWeight: 'bold' }}>Diário Filosófico</h1>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL (VITRINE + LOGIN) */}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div style={{ maxWidth: '1200px', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4rem', alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* LADO DIREITO: O FORMULÁRIO DE LOGIN (INTACTO) */}
            <div style={{ flex: '1 1 400px', maxWidth: '450px', margin: '0 auto' }}>
              <div style={{ background: 'white', padding: '2.5rem 2rem', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(139, 115, 85, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: "'Cinzel', serif", color: '#2c1810', fontSize: '1.8rem' }}>{isLogin ? 'Bem-vindo de volta' : 'Iniciar Jornada'}</h2>
                  <p style={{ color: '#6b5744', fontSize: '0.95rem', margin: 0 }}>Entre para acessar seus registros</p>
                </div>

                <form onSubmit={handleAuth}>
                  <input type="email" placeholder="Seu E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.85rem', marginBottom: '1rem', border: '2px solid #e8dcc4', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', transition: 'border-color 0.3s', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = '#8b7355'} onBlur={(e) => e.target.style.borderColor = '#e8dcc4'} />
                  <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <input type={showPassword ? 'text' : 'password'} placeholder="Sua Senha" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.85rem', paddingRight: '3rem', border: '2px solid #e8dcc4', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', transition: 'border-color 0.3s', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = '#8b7355'} onBlur={(e) => e.target.style.borderColor = '#e8dcc4'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {showPassword ? <EyeOff size={20} color="#8b7355" /> : <Eye size={20} color="#8b7355" />}
                    </button>
                  </div>
                  
                  {error && <div className="animate-fadeIn" style={{ background: '#fee', color: '#c33', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid #fcc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={16} /> {error}</div>}
                  
                  <button type="submit" style={{ width: '100%', padding: '0.85rem', background: '#6b4423', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', fontFamily: 'Georgia, serif', transition: 'background 0.2s, transform 0.1s' }} onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.target.style.transform = 'scale(1)'}>{isLogin ? 'Acessar Diário' : 'Criar Nova Conta'}</button>
                  <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{ width: '100%', padding: '0.85rem', background: 'transparent', color: '#6b4423', border: '2px solid #8b7355', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.target.style.background = 'transparent'}>{isLogin ? 'Não tem conta? Cadastre-se' : 'Já tenho conta'}</button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: '#a89c8a' }}><div style={{ flex: 1, height: '1px', background: '#e8dcc4' }}></div><span style={{ padding: '0 1rem', fontSize: '0.85rem', fontStyle: 'italic' }}>ou continue com</span><div style={{ flex: 1, height: '1px', background: '#e8dcc4' }}></div></div>
                  
                  <button type="button" onClick={handleGoogleLogin} style={{ width: '100%', padding: '0.85rem', background: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = '#f9f9f9'} onMouseOut={(e) => e.target.style.background = '#fff'}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style={{ width: '20px', height: '20px' }} /> Entrar com Google
                  </button>
                </form>
              </div>
            </div>

            {/* LADO ESQUERDO: CONTEÚDO PARA O GOOGLE ADSENSE E NOVOS USUÁRIOS */}
            <div style={{ flex: '1 1 500px', color: '#2c1810' }}>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontFamily: "'Cinzel', serif", marginBottom: '1.5rem', lineHeight: '1.2', color: '#4a3320' }}>
                Conhece-te a ti mesmo.
              </h2>
              <p style={{ fontSize: '1.15rem', lineHeight: '1.8', color: '#5c4632', marginBottom: '1.5rem' }}>
                O <strong>Diário Filosófico</strong> é um ambiente digital minimalista inspirado nas práticas de autoexame das escolas de sabedoria clássica. Desenvolvido para auxiliar no forjamento do caráter, ele permite que você registre suas reflexões, avalie seus erros e cultive a clareza mental diariamente.
              </p>
              
              <blockquote style={{ borderLeft: '4px solid #8b7355', paddingLeft: '1.5rem', margin: '2rem 0', fontStyle: 'italic', fontSize: '1.2rem', color: '#6b5744' }}>
                "Que ninguém hesite em se dedicar à filosofia enquanto jovem, nem se canse de fazê-lo depois de velho." — Epicuro
              </blockquote>

              <h3 style={{ fontSize: '1.3rem', color: '#4a3320', marginBottom: '1rem', fontFamily: "'Cinzel', serif" }}>Cultive as Virtudes Clássicas:</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { nome: 'Sabedoria', desc: 'Compreensão profunda e discernimento.' },
                  { nome: 'Justiça', desc: 'Equidade, retidão e dever cumprido.' },
                  { nome: 'Coragem', desc: 'Força interior para enfrentar o medo.' },
                  { nome: 'Temperança', desc: 'Moderação, disciplina e autodomínio.' }
                ].map(v => (
                  <li key={v.nome} style={{ background: 'rgba(255, 255, 255, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(139, 115, 85, 0.2)' }}>
                    <strong style={{ display: 'block', color: '#8b7355', marginBottom: '0.25rem' }}>{v.nome}</strong>
                    <span style={{ fontSize: '0.9rem', color: '#6b5744' }}>{v.desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            

          </div>
        </main>

        {/* RODAPÉ SIMPLES PARA O ROBÔ */}
        <footer style={{ padding: '2rem', textAlign: 'center', color: '#8b7355', fontSize: '0.9rem', borderTop: '1px solid rgba(139, 115, 85, 0.2)' }}>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} Diário Filosófico. Desenvolvido para a clareza e autoconhecimento.</p>
        </footer>

        
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)', fontFamily: 'Georgia, serif', transition: 'background 0.3s ease' }}>
      <header style={{ padding: '1rem 2rem', borderBottom: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, background: isDark ? 'rgba(26, 26, 46, 0.95)' : 'rgba(240, 230, 210, 0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* LOGO */}
          <div onClick={handleLogoClick} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <BookOpen size={32} color={isDark ? '#d4af37' : '#6b4423'} />
            <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(1rem, 3.5vw, 1.5rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 700 }}>
              Diário Filosófico <span style={{ fontWeight: 'normal', fontStyle: 'italic', fontSize: '0.85em', opacity: 0.9 }}>de {getUserFirstName()}</span>
            </h1>
          </div>

          {/* CONTROLES CONDICIONAIS (PC vs CELULAR) */}
          {isMobile ? (
            // VERSÃO CELULAR (Limpa e Minimalista)
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              
              {/* BADGE DE FOGO */}
              <div onClick={() => setShowStreakModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.6rem', background: streak > 0 ? (isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'), border: `1px solid ${streak > 0 ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? '#555' : '#ccc')}`, borderRadius: '12px', color: streak > 0 ? (isDark ? '#ffb74d' : '#e65100') : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 }}>
                <StreakIcon size={14} fill={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : 'none'} color={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : (isDark ? '#aaa' : '#777')} /> {streak}
              </div>

              <button onClick={toggleNotifications} style={{ position: 'relative', padding: '0.3rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <Bell size={22} color={notificationsActive ? '#4caf50' : (isDark ? '#d4af37' : '#6b4423')} />
                {notificationsActive && <div style={{ position: 'absolute', top: '0', right: '0', background: '#4caf50', borderRadius: '50%', padding: '1px' }}><Check size={8} color="white" strokeWidth={4} /></div>}
              </button>
              
              <button onClick={toggleTheme} style={{ padding: '0.3rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {isDark ? <Sun size={22} color="#d4af37" /> : <Moon size={22} color="#8b7355" />}
              </button>
              
              <button onClick={() => setIsMobileMenuOpen(true)} style={{ padding: '0.3rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <Menu size={28} color={isDark ? '#d4af37' : '#6b4423'} />
              </button>
            </div>
          ) : (
            // VERSÃO COMPUTADOR (Completa)
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              
              {/* BADGE DE FOGO (SEMPRE VISÍVEL NO PC) */}
              <div onClick={() => setShowStreakModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: streak > 0 ? (isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'), border: `1px solid ${streak > 0 ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? '#555' : '#ccc')}`, borderRadius: '20px', color: streak > 0 ? (isDark ? '#ffb74d' : '#e65100') : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontFamily: 'Georgia, serif', fontSize: '0.9rem', marginRight: '0.5rem', cursor: 'pointer', boxShadow: streak > 0 && isDark ? '0 0 10px rgba(255, 152, 0, 0.2)' : 'none' }}>
                <StreakIcon size={18} fill={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : 'none'} color={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : (isDark ? '#aaa' : '#777')} />
                <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
              </div>

              

              {/* DROPDOWN 1: DIÁRIO */}
              <div 
                style={{ position: 'relative', display: 'flex', flexDirection: 'column' }} 
                onMouseLeave={() => setShowDiaryMenu(false)}
              >
                <button 
                  onMouseEnter={() => setShowDiaryMenu(true)}
                  onClick={() => setShowDiaryMenu(!showDiaryMenu)} 
                  style={{ padding: '0.5rem 1rem', background: ['today', 'history', 'analytics'].includes(view) ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: ['today', 'history', 'analytics'].includes(view) ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                >
                  <BookOpen size={16} /> Diário {showDiaryMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showDiaryMenu && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: '0.5rem', zIndex: 1000 }}>
                    <div className="animate-fadeIn" style={{ width: '160px', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(255, 255, 255, 0.98)', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
                      <button onClick={() => { setView('today'); setShowDiaryMenu(false); }} style={{ padding: '0.75rem 1rem', background: view === 'today' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = view === 'today' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent'}>☀️ Hoje</button>
                      <button onClick={() => { setView('history'); setShowDiaryMenu(false); }} style={{ padding: '0.75rem 1rem', background: view === 'history' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = view === 'history' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent'}>📚 Histórico</button>
                      <button onClick={() => { setView('analytics'); setShowDiaryMenu(false); }} style={{ padding: '0.75rem 1rem', background: view === 'analytics' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = view === 'analytics' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent'}><TrendingUp size={16}/> Métricas</button>
                    </div>
                  </div>
                )}
              </div>

              {/* DROPDOWN 2: A FORJA */}
              <div 
                style={{ position: 'relative', display: 'flex', flexDirection: 'column' }} 
                onMouseLeave={() => setShowPracticesMenu(false)}
              >
                <button 
                  onMouseEnter={() => setShowPracticesMenu(true)}
                  onClick={() => setShowPracticesMenu(!showPracticesMenu)} 
                  style={{ padding: '0.5rem 1rem', background: ['tasks', 'goals', 'biblioteca'].includes(view) ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: ['tasks', 'goals', 'biblioteca'].includes(view) ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                >
                  <Target size={16} /> A Forja {showPracticesMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showPracticesMenu && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: '0.5rem', zIndex: 1000 }}>
                    <div className="animate-fadeIn" style={{ width: '160px', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(255, 255, 255, 0.98)', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
                      <button onClick={() => { setView('tasks'); setShowPracticesMenu(false); }} style={{ padding: '0.75rem 1rem', background: view === 'tasks' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = view === 'tasks' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent'}>📋 Tarefas</button>
                      <button onClick={() => { setView('goals'); setShowPracticesMenu(false); }} style={{ padding: '0.75rem 1rem', background: view === 'goals' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = view === 'goals' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent'}>🎯 Metas</button>
                      <button onClick={() => { setView('leituras'); setShowPracticesMenu(false); }} style={{ padding: '0.75rem 1rem', background: view === 'leituras' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = view === 'leituras' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent'}><Library size={16}/> Leituras</button>
                      <button onClick={() => { setView('biblioteca'); setShowPracticesMenu(false); }} style={{ padding: '0.75rem 1rem', background: view === 'biblioteca' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = view === 'biblioteca' ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent'}>🏛️ Virtudes</button>
                    </div>
                  </div>
                )}
              </div>


              {/* ATALHO RÁPIDO DO TRATAK (GLOBAL) */}
              <button onClick={() => { setActivePracticeId('tratack'); setPracticePhase('intro'); setIsPracticeActive(true); }} style={{ padding: '0.5rem 1rem', background: isDark ? '#b8a88a' : '#8b7355', color: isDark ? '#1a1a2e' : '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                <Target size={16} /> Tratak
              </button>

              {fvUnlocked && (
                <button onClick={handleFvTabClick} style={{ padding: '0.5rem 1rem', background: view === 'fv' ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 'transparent', color: view === 'fv' ? '#000' : '#FFD700', border: '2px solid #FFD700', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>FV</button>
              )}
              
              {/* MENU DE OPÇÕES (DROPDOWN) - CORRIGIDO */}
              <div 
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }} 
                onMouseLeave={() => setShowProfileMenu(false)}
              >
                <button 
                  onMouseEnter={() => setShowProfileMenu(true)}
                  onClick={() => setShowProfileMenu(!showProfileMenu)} 
                  style={{ padding: '0.5rem 1rem', background: showProfileMenu ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: showProfileMenu ? (isDark ? '#1a1a2e' : 'white') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                >
                  <Settings size={18} /> Opções {showProfileMenu ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {/* A LISTA DE OPÇÕES AGORA ESTÁ COLADA NO BOTÃO (Tiramos o vão invisível) */}
                {showProfileMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: '0.5rem', zIndex: 1000 }}>
                    <div className="animate-fadeIn" style={{ width: '220px', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(255, 255, 255, 0.98)', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
                      
                      <button onClick={() => { toggleNotifications(); setShowProfileMenu(false); }} style={{ padding: '1rem', background: 'transparent', border: 'none', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        <Bell size={18} color={notificationsActive ? '#4caf50' : (isDark ? '#d4af37' : '#6b4423')} /> {notificationsActive ? 'Lembretes (ON)' : 'Lembretes (OFF)'}
                      </button>
                      
                      <button onClick={() => { setShowSuggestionModal(true); setShowProfileMenu(false); }} style={{ padding: '1rem', background: 'transparent', border: 'none', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        <MessageSquare size={18} color={isDark ? '#d4af37' : '#6b4423'} /> Enviar Sugestão
                      </button>
                      
                      <button onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); }} style={{ padding: '1rem', background: 'transparent', border: 'none', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        <Settings size={18} color={isDark ? '#d4af37' : '#6b4423'} /> Configurações
                      </button>
                      
                      <button onClick={() => { toggleTheme(); setShowProfileMenu(false); }} style={{ padding: '1rem', background: 'transparent', border: 'none', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        {isDark ? <Sun size={18} color="#d4af37" /> : <Moon size={18} color="#8b7355" />} Tema: {isDark ? 'Mudar para Claro' : 'Mudar para Escuro'}
                      </button>
                      
                      <button onClick={() => { handleLogout(); setShowProfileMenu(false); }} style={{ padding: '1rem', background: 'rgba(231, 76, 60, 0.05)', border: 'none', color: '#e74c3c', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', fontWeight: 'bold', fontFamily: 'Georgia, serif' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.05)'}>
                        <LogOut size={18} /> Sair do Diário
                      </button>
                    </div>
                  </div>
                )}
              
              </div>
            </div>
          )}
        </div>
      </header>

      {/* MENU SUSPENSO MOBILE */}
      {isMobileMenuOpen && (
        <div className="animate-fadeIn" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, height: '100dvh', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(240, 230, 210, 0.98)', zIndex: 10001, backdropFilter: 'blur(10px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '1.5rem', paddingBottom: '120px', minHeight: '101%', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2rem', borderBottom: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.5rem' }}>Menu</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={32} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {['today', 'history', 'tasks', 'goals', 'leituras', 'biblioteca', 'analytics'].map((item) => {
                const labels = { today: '☀️ Hoje', history: '📚 Histórico', tasks: '📋 Tarefas', goals: '🎯 Metas', leituras: '📖 Leituras', biblioteca: '🏛️ Virtudes', analytics: '📊 Métricas' };
                return (
                  <button 
                    key={item}
                    onClick={() => { setView(item); setIsMobileMenuOpen(false); }} 
                    style={{ width: '100%', padding: '1.2rem', textAlign: 'left', background: view === item ? (isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)') : 'transparent', color: view === item ? (isDark ? '#FFD700' : '#6b4423') : (isDark ? '#f0e6d2' : '#2c1810'), border: `1px solid ${view === item ? (isDark ? '#d4af37' : '#6b4423') : 'transparent'}`, borderRadius: '12px', fontSize: '1.3rem', fontFamily: 'Georgia, serif', fontWeight: view === item ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  >
                    {labels[item]}
                  </button>
                );
              })}

              <button onClick={() => { setIsMobileMenuOpen(false); setActivePracticeId('tratack'); setPracticePhase('intro'); setIsPracticeActive(true); }} style={{ width: '100%', padding: '1.2rem', textAlign: 'left', background: 'transparent', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid transparent', borderRadius: '12px', fontSize: '1.3rem', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Target size={24} color={isDark ? '#f0e6d2' : '#2c1810'} /> Tratak
              </button>
              
              {fvUnlocked && (
                <button onClick={() => { setView('fv'); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1.2rem', textAlign: 'left', background: view === 'fv' ? 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%)' : 'transparent', color: view === 'fv' ? '#FFD700' : (isDark ? '#f0e6d2' : '#2c1810'), border: `1px solid ${view === 'fv' ? '#FFD700' : 'transparent'}`, borderRadius: '12px', fontSize: '1.3rem', fontFamily: 'Georgia, serif', fontWeight: view === 'fv' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Award size={24} color="#FFD700" /> FV
                </button>
              )}
            </div>

            <div style={{ marginTop: '4rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '2rem', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
              <button onClick={() => { setShowSuggestionModal(true); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} /> Enviar Sugestão
              </button>
              
              <button onClick={() => { setShowSettingsModal(true); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Settings size={20} /> Configurações
              </button>

              <button onClick={handleLogout} style={{ width: '100%', padding: '1rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <LogOut size={20} /> Sair do Diário
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* VIEW: TODAY */}
        {view === 'today' && (
          <div>
            {/* SELETOR DE DATA RETROATIVA */}
            {/* SELETOR DE DATA RETROATIVA COM ALERTA DE COR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', padding: '1rem', 
              background: selectedDate !== getTodayKey() ? (isDark ? 'rgba(231, 76, 60, 0.15)' : 'rgba(231, 76, 60, 0.1)') : (isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)'), 
              borderRadius: '12px', 
              border: `2px solid ${selectedDate !== getTodayKey() ? '#e74c3c' : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}` 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={24} color={isDark ? '#d4af37' : '#6b4423'} />
                <span style={{ fontWeight: 'bold', color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif", fontSize: '1.2rem' }}>
                  {selectedDate === getTodayKey() ? "Hoje" : "Registro do dia"}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => handleDateChange(e.target.value)}
                  max={getTodayKey()} 
                  style={{ padding: '0.6rem', borderRadius: '8px', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem', fontFamily: 'Georgia, serif', cursor: 'pointer' }} 
                />
                
                {selectedDate !== getTodayKey() && (
                  <button onClick={() => handleDateChange(getTodayKey())} style={{ padding: '0.6rem 1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    Voltar para Hoje
                  </button>
                )}
              </div>
            </div>
            {dailyQuote && (
              <div style={{ padding: '2rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.6)', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, marginBottom: '2rem' }}>
                <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', fontStyle: 'italic', color: isDark ? '#f0e6d2' : '#2c1810', marginBottom: '1rem', lineHeight: '1.8' }}>"{dailyQuote.text}"</p>
                <p style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1rem)', color: isDark ? '#b8a88a' : '#6b5744', textAlign: 'right', margin: 0 }}>— {dailyQuote.author}</p>
              </div>
            )}

            {getTasksForToday().length > 0 && (
              <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem', color: isDark ? '#f0e6d2' : '#2c1810' }}>✓ Práticas de Hoje</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {getTasksForToday().map(task => (
                    <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <input type="checkbox" checked={todayTasksStatus[task.id] || false} onChange={() => toggleTaskStatus(task.id)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                      <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', textDecoration: todayTasksStatus[task.id] ? 'line-through' : 'none', opacity: todayTasksStatus[task.id] ? 0.6 : 1 }}>{task.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* O CAMPO DE KURUKSHETRA (SISTEMA DE AUDITORIA DE VÍCIOS VS VIRTUDES) */}
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : '#fffbf0', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', zIndex: 1 }}>
                <h3 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Swords size={20} /> A Batalha Interior
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            
            {/* BOTÃO DE ATIVAR/DESATIVAR */}
            <button 
              onClick={async () => {
                const novoEstado = !kuravaEnabled;
                setKuravaEnabled(novoEstado);
                await setDoc(doc(db, 'fvData', user.uid), { kuravaEnabled: novoEstado }, { merge: true });
              }}
              style={{ 
                background: 'transparent', border: `1px solid ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(139,115,85,0.3)'}`,
                borderRadius: '20px', padding: '4px 12px', fontSize: '0.7rem', cursor: 'pointer',
                color: kuravaEnabled ? '#4caf50' : '#e74c3c', transition: 'all 0.3s'
              }}
            >
              {kuravaEnabled ? '● Diagnóstico Ativo' : '○ Diagnóstico Pausado'}
            </button>
          </div>

          {/* SÓ MOSTRA O CONTEÚDO SE ESTIVER ATIVADO */}
          {!kuravaEnabled ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px dashed rgba(139,115,85,0.3)' }}>
               <p style={{ margin: 0, fontStyle: 'italic', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem' }}>
                 A avaliação automática do Oráculo está desativada. Seus registros permanecem privados.
               </p>
            </div>
          ) : (
             <>
               {/* AQUI FICA O RESTANTE DO SEU CÓDIGO DO KURUKSCHETRA (DIAGNÓSTICO, PANDAVA, ETC) */}
             </>
          )}
                <button onClick={generateKuravaAnalysis} disabled={isGeneratingKurava} style={{ padding: '0.5rem 1rem', background: 'transparent', color: isDark ? '#FFD700' : '#996515', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#996515'}`, borderRadius: '6px', cursor: isGeneratingKurava ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', transition: 'all 0.3s ease' }}>
                  {isGeneratingKurava ? <Sparkles className="animate-spin" size={14} /> : <Search size={14} />}
                  {isGeneratingKurava ? 'Avaliando o Campo...' : 'Identificar o Kurava Oculto (Últimos 7 dias)'}
                </button>
              </div>

              {!kuravaData ? (
                <p style={{ margin: 0, color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.95rem', fontStyle: 'italic', zIndex: 1 }}>Sua mente é Kurukshetra. Acione o oráculo para cruzar seus últimos 7 dias e revelar qual defeito (Kurava) está dominando o campo, e qual virtude (Pandava) você deve convocar.</p>
              ) : (
                <div className="animate-fadeIn" style={{ display: 'grid', gap: '1rem', zIndex: 1 }}>
                  
                  {/* O VÉU DO ORÁCULO (KURAVA OCULTO) */}
                  {!isKuravaRevealed ? (
                    <div 
                      onClick={() => setIsKuravaRevealed(true)}
                      style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(139, 115, 85, 0.05)', padding: '2rem', borderRadius: '12px', border: `1px dashed ${isDark ? '#FFD700' : '#996515'}`, textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)' }}
                      onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(139, 115, 85, 0.05)'}
                    >
                      <EyeOff size={32} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                      <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif", fontSize: '1.2rem' }}>O Oráculo Falou</h4>
                      <p style={{ margin: 0, color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.95rem', fontStyle: 'italic' }}>Clique aqui para revelar o Kurava que domina a sua semana e a Arma para combatê-lo.</p>
                    </div>
                  ) : (
                    <div className="animate-fadeIn" style={{ display: 'grid', gap: '1rem', zIndex: 1 }}>
                      {/* BOTÃO PARA ESCONDER NOVAMENTE */}
                      <button onClick={() => setIsKuravaRevealed(false)} style={{ justifySelf: 'end', background: 'transparent', border: 'none', color: isDark ? '#b8a88a' : '#6b5744', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Eye size={14}/> Ocultar Diagnóstico</button>
                      
                      {/* DISPLAY DUPLO: KURAVA VS PANDAVA */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: isDark ? 'rgba(231, 76, 60, 0.1)' : '#fff5f5', padding: '1.5rem', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(231, 76, 60, 0.4)' : 'rgba(231, 76, 60, 0.4)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: isDark ? '#e74c3c' : '#c0392b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem' }}>O Kurava da Semana</span>
                          <strong style={{ fontSize: '1.6rem', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>{kuravaData.kurava}</strong>
                        </div>

                        <div style={{ background: isDark ? 'rgba(76, 175, 80, 0.1)' : '#f0fdf4', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.4)' : '#4caf50'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: '-10px', background: isDark ? '#81c784' : '#2e7d32', color: isDark ? '#1a1a2e' : 'white', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>A Arma</div>
                          <span style={{ fontSize: '0.75rem', color: isDark ? '#81c784' : '#2e7d32', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', marginTop: '0.5rem' }}>Invoque o Pandava</span>
                          <strong style={{ fontSize: '1.6rem', color: isDark ? '#81c784' : '#2e7d32', fontFamily: "'Cinzel', serif", filter: 'drop-shadow(0 0 5px rgba(76, 175, 80, 0.3))' }}>{kuravaData.pandava}</strong>
                        </div>
                      </div>
                      
                      <div style={{ background: isDark ? 'rgba(0,0,0,0.3)' : 'white', padding: '1rem', borderRadius: '8px', borderLeft: `3px solid ${isDark ? '#e74c3c' : '#c0392b'}` }}>
                        <span style={{ fontSize: '0.75rem', color: isDark ? '#e74c3c' : '#c0392b', fontWeight: 'bold', textTransform: 'uppercase' }}>Análise do Campo:</span>
                        <p style={{ margin: '0.2rem 0 0 0', color: isDark ? '#c8b896' : '#6b5744', fontSize: '0.95rem', lineHeight: '1.5' }}>{kuravaData.diagnostico}</p>
                      </div>

                      <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.1)' : '#fffbf0', padding: '1rem', borderRadius: '8px', borderLeft: `3px solid ${isDark ? '#FFD700' : '#996515'}` }}>
                        <span style={{ fontSize: '0.75rem', color: isDark ? '#FFD700' : '#996515', fontWeight: 'bold', textTransform: 'uppercase' }}>Estratégia do Dharma:</span>
                        <p style={{ margin: '0.2rem 0 0 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', lineHeight: '1.5', fontStyle: 'italic' }}>"{kuravaData.estrategia}"</p>
                      </div>
                    </div>
                  )}
                  
                  
                </div>
              )}
            </div>

            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', marginBottom: '2rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Sunrise size={28} color={isDark ? '#ffd966' : '#ff9800'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810' }}>Prólogo Matinal</h2>
              </div>

              {morningDone ? (
                <div style={{ padding: '1.5rem', background: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9', borderRadius: '12px', border: `2px solid ${isDark ? 'rgba(76, 175, 80, 0.4)' : '#4caf50'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={24} color="#4caf50" />
                      <h3 style={{ margin: 0, color: isDark ? '#81c784' : '#2e7d32' }}>Prólogo Completo!</h3>
                    </div>
                    <button onClick={() => setMorningDone(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#81c784' : '#2e7d32', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      <Edit size={16} /> Editar
                    </button>
                  </div>
                  <p style={{ margin: '0.5rem 0', color: isDark ? '#c8e6c9' : '#1b5e20' }}><strong>Virtude do dia:</strong> {selectedVirtue || customVirtue}</p>
                  {dailyIntention && <p style={{ margin: '0.5rem 0', color: isDark ? '#c8e6c9' : '#1b5e20' }}><strong>Compromisso:</strong> {dailyIntention}</p>}
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>Virtude do Dia:</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <button onClick={selectRandomVirtue} disabled={!canDrawToday()} style={{ padding: '0.75rem 1.5rem', background: canDrawToday() ? (isDark ? '#d4af37' : '#6b4423') : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'), color: canDrawToday() ? 'white' : (isDark ? '#888' : '#999'), border: 'none', borderRadius: '8px', cursor: canDrawToday() ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
                        <Shuffle size={18} /> {canDrawToday() ? 'Sortear Virtude' : 'Já sorteou hoje'}
                      </button>
                      <button onClick={() => setShowCustomVirtue(!showCustomVirtue)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
                        {showCustomVirtue ? 'Escolher da Lista' : 'Escrever Própria'}
                      </button>
                    </div>

                    {showCustomVirtue ? (
                      <input type="text" placeholder="Digite sua virtude..." value={customVirtue} onChange={(e) => setCustomVirtue(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    ) : (
                      <select value={selectedVirtue} onChange={(e) => setSelectedVirtue(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                        <option value="">Selecione uma virtude...</option>
                        {virtues.map((v, idx) => <option key={idx} value={v.name}>{v.name}</option>)}
                      </select>
                    )}

                    {selectedVirtue && !showCustomVirtue && (
                      <div 
                        onClick={() => setIsTodayVirtueExpanded(!isTodayVirtueExpanded)}
                        style={{ marginTop: '1rem', padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.5)', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, cursor: 'pointer', transition: 'all 0.3s ease' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ margin: '0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>{selectedVirtue}</h4>
                          {isTodayVirtueExpanded ? <ChevronUp size={20} color={isDark ? '#d4af37' : '#6b4423'} /> : <ChevronDown size={20} color={isDark ? '#d4af37' : '#6b4423'} />}
                        </div>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: isDark ? '#c8b896' : '#6b5744', fontStyle: 'italic' }}>
                          {virtues.find(v => v.name === selectedVirtue)?.shortDesc}
                        </p>

                        {/* CONTEÚDO EXPANDIDO (DESCRIÇÃO, PRÁTICAS E CITAÇÃO) */}
                        {isTodayVirtueExpanded && (
                          <div className="animate-fadeIn" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                            
                            {/* A CITAÇÃO DA VIRTUDE */}
                            {virtues.find(v => v.name === selectedVirtue)?.quote && (
                              <blockquote style={{ margin: '0 0 1.5rem 0', padding: '1rem', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)', borderLeft: `4px solid ${virtues.find(v => v.name === selectedVirtue)?.color || '#d4af37'}`, borderRadius: '0 8px 8px 0' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontStyle: 'italic', fontSize: '1rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.5' }}>"{virtues.find(v => v.name === selectedVirtue)?.quote}"</p>
                                <footer style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', fontWeight: 'bold', textAlign: 'right' }}>— {virtues.find(v => v.name === selectedVirtue)?.quoteAuthor}</footer>
                              </blockquote>
                            )}

                            <p style={{ fontSize: '0.95rem', color: isDark ? '#f0e6d2' : '#2c1810', marginBottom: '1rem', lineHeight: '1.6' }}>
                              {virtues.find(v => v.name === selectedVirtue)?.description}
                            </p>
                            <div style={{ padding: '0.75rem', background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'rgba(255, 255, 255, 0.5)', borderRadius: '8px' }}>
                              <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: isDark ? '#d4af37' : '#6b4423', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Práticas Sugeridas:</h5>
                              <p style={{ fontSize: '0.9rem', color: isDark ? '#c8b896' : '#6b5744', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                                {virtues.find(v => v.name === selectedVirtue)?.practices}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>Meu compromisso para hoje:</label>
                    <textarea value={dailyIntention} onChange={(e) => setDailyIntention(e.target.value)} placeholder="Como vou praticar esta virtude hoje?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <button onClick={saveMorning} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: 'clamp(1rem, 2vw, 1.1rem)', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={20} /> Salvar Prólogo
                  </button>
                </div>
              )}
            </div>

            {/* EPÍLOGO */}
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Sunset size={28} color={isDark ? '#b19cd9' : '#9c27b0'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810' }}>Epílogo Noturno</h2>
              </div>

              {eveningDone ? (
                <div style={{ padding: '1.5rem', background: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9', borderRadius: '12px', border: `2px solid ${isDark ? 'rgba(76, 175, 80, 0.4)' : '#4caf50'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={24} color="#4caf50" />
                      <h3 style={{ margin: 0, color: isDark ? '#81c784' : '#2e7d32' }}>Epílogo Completo!</h3>
                    </div>
                    <button onClick={() => setEveningDone(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#81c784' : '#2e7d32', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      <Edit size={16} /> Editar
                    </button>
                  </div>
                  <p style={{ margin: 0, color: isDark ? '#c8e6c9' : '#1b5e20' }}>Exame noturno realizado. Descanse bem! 🌙</p>
                </div>
              ) : (
                <div>
                  {!morningDone && (
                    <div style={{ padding: '1rem', background: isDark ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.1)', borderRadius: '8px', marginBottom: '1.5rem', border: `2px solid ${isDark ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 152, 0, 0.3)'}` }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', color: isDark ? '#ffb74d' : '#e65100' }}>
                        <input type="checkbox" checked={!didMorning} onChange={(e) => setDidMorning(!e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                        <span style={{ fontWeight: 600 }}>Não fiz o Prólogo hoje</span>
                      </label>
                    </div>
                  )}

                  <p style={{ marginBottom: '1.5rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>"Que ninguém durma sem antes examinar as ações do dia" — Versos de Ouro de Pitágoras</p>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>1. Em que falhei hoje?</label>
                    <textarea value={whereIFailed} onChange={(e) => setWhereIFailed(e.target.value)} placeholder="Onde não agi conforme meus princípios?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>2. O que fiz bem?</label>
                    <textarea value={whatIDidWell} onChange={(e) => setWhatIDidWell(e.target.value)} placeholder="Quais virtudes pratiquei?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>3. O que deixei de fazer?</label>
                    <textarea value={whatILeftUndone} onChange={(e) => setWhatILeftUndone(e.target.value)} placeholder="O que poderia ter feito melhor?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', margin: '2rem 0', color: isDark ? '#d4af37' : '#8b7355' }}><div style={{ flex: 1, height: '1px', background: isDark ? 'rgba(212, 175, 55, 0.3)' : '#e8dcc4' }}></div><span style={{ padding: '0 1rem', fontSize: '0.85rem', fontStyle: 'italic', fontWeight: 'bold' }}>OU</span><div style={{ flex: 1, height: '1px', background: isDark ? 'rgba(212, 175, 55, 0.3)' : '#e8dcc4' }}></div></div>

                  <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>Reflexão Livre (Opcional):</label>
                    <textarea value={freeEpilogue} onChange={(e) => setFreeEpilogue(e.target.value)} placeholder="Se preferir, escreva livremente sobre o seu dia aqui..." rows={5} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <button onClick={saveEvening} style={{ width: '100%', padding: '1rem', background: isDark ? '#b19cd9' : '#9c27b0', color: 'white', border: 'none', borderRadius: '8px', fontSize: 'clamp(1rem, 2vw, 1.1rem)', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={20} /> Salvar Epílogo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

          

        {/* VIEW: TASKS */}
        
        {view === 'tasks' && (
          <div className="animate-fadeIn">
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>
                  Tarefas Personalizadas
                </h2>
                <button
                  onClick={() => {
                    setEditingTaskId(null); setNewTaskName(''); setNewTaskRecurrence('daily');
                    setNewTaskWeekDays([]); setNewTaskMonthDay(1); setNewTaskBaseDate('');
                    setShowAddTask(true);
                  }}
                  style={{ padding: '0.75rem 1.5rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Plus size={18} /> Nova Tarefa
                </button>
              </div>

              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem' }}>
                Cadastre práticas que deseja acompanhar (ex: Meditação, Leitura, Exercícios)
              </p>

              {showAddTask && (
                <div style={{ padding: '1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '12px', marginBottom: '2rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif" }}>{editingTaskId ? 'Editar Prática' : 'Nova Prática'}</h3>
                    <button onClick={() => { setShowAddTask(false); setEditingTaskId(null); }} style={{ background: 'transparent', color: '#e74c3c', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Nome da prática..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontSize: '1rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: isDark ? '#d4af37' : '#6b4423', fontWeight: 'bold' }}>Periodicidade:</label>
                    <select value={newTaskRecurrence} onChange={(e) => setNewTaskRecurrence(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                      <option value="daily">Diariamente</option>
                      <option value="weekly">Dias da Semana Específicos</option>
                      <option value="biweekly">Quinzenalmente (A cada 14 dias)</option>
                      <option value="monthly">Uma vez ao Mês</option>
                    </select>
                  </div>

                  {newTaskRecurrence === 'weekly' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                        <button key={idx} onClick={() => {
                                setPostReadInvite(null); // Fecha o convite
                                runSocraticTutor(postReadInvite, topic); // Abre o modal e já CHAMA A IA com o tema!
                              }}>{day}</button>
                      ))}
                    </div>
                  )}

                  {newTaskRecurrence === 'biweekly' && (
                    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>Qual é a data do próximo encontro/prática?</label>
                      <input type="date" value={newTaskBaseDate || ''} onChange={(e) => setNewTaskBaseDate(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                  )}

                  {newTaskRecurrence === 'monthly' && (
                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>Todo dia:</span>
                      <input type="number" min="1" max="31" value={newTaskMonthDay} onChange={(e) => setNewTaskMonthDay(e.target.value)} style={{ width: '60px', padding: '0.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                  )}

                  <button onClick={saveCustomTask} style={{ width: '100%', padding: '0.75rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                    <Save size={18} /> {editingTaskId ? 'Salvar Alterações' : 'Adicionar Tarefa'}
                  </button>
                </div>
              )}

              {customTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: isDark ? '#b8a88a' : '#6b5744' }}>
                  <CheckCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '1.1rem' }}>Nenhuma prática cadastrada</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {customTasks.map(task => {
                    let freqText = 'Diariamente';
                    if (task.recurrence === 'weekly') {
                      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                      freqText = task.weekDays?.map(d => days[d]).join(', ');
                    } else if (task.recurrence === 'biweekly') {
                      freqText = task.baseDate ? `Quinzenal (a partir de ${task.baseDate.split('-')[2]}/${task.baseDate.split('-')[1]})` : 'Quinzenalmente';
                    } else if (task.recurrence === 'monthly') {
                      freqText = `Todo dia ${task.monthDay}`;
                    }

                    return (
                      <div key={task.id} style={{ padding: '1rem', background: isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>{task.name}</div>
                          <div style={{ fontSize: '0.85rem', color: isDark ? '#d4af37' : '#6b4423', marginTop: '0.2rem' }}>↻ {freqText}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => startEditingTask(task)} style={{ padding: '0.5rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `1px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '6px', cursor: 'pointer', display: 'flex' }} title="Editar"><Edit size={16} /></button>
                          <button onClick={() => { if(window.confirm(`Deseja realmente excluir a prática "${task.name}"?`)) { removeCustomTask(task.id); } }} style={{ padding: '0.5rem', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '6px', cursor: 'pointer', display: 'flex' }} title="Excluir"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: GOALS */}
        {view === 'goals' && (
          <div className="animate-fadeIn">
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Target size={32} color={isDark ? '#d4af37' : '#6b4423'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>Horizonte de Vida</h2>
              </div>
              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>O que o homem constrói no mundo reflete o que ele constrói em si mesmo.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                
                {/* BLOCO 1: SONHOS (VIRTUDES) */}
                <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Star size={20} /> Sonhos (Forja Interior)</h3>
                  <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '1rem' }}>Virtudes e qualidades que deseja conquistar.</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <input type="text" value={newVirtueGoal} onChange={(e) => setNewVirtueGoal(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') addVirtueGoal() }} placeholder="Ex: Desenvolver mais paciência..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    <button onClick={addVirtueGoal} style={{ padding: '0 1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}><Plus size={20} /></button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {virtueGoals.map(goal => (
                      <div key={goal.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', borderRadius: '8px', border: `1px solid ${goal.completed ? '#4caf50' : (isDark ? 'rgba(212, 175, 55, 0.2)' : '#eee')}` }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', flex: 1 }}>
                          <input type="checkbox" checked={goal.completed} onChange={() => toggleGoal(goal.id, 'virtue')} style={{ width: '18px', height: '18px', marginTop: '0.2rem', accentColor: '#d4af37' }} />
                          <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', textDecoration: goal.completed ? 'line-through' : 'none', opacity: goal.completed ? 0.6 : 1, lineHeight: '1.4' }}>{goal.text}</span>
                        </label>
                        <button onClick={() => removeGoal(goal.id, 'virtue')} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '0.2rem' }}><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BLOCO 2: PROJETOS (AÇÕES NO MUNDO) */}
                <div style={{ background: isDark ? 'rgba(74, 144, 226, 0.05)' : '#f4f8ff', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.2)' : 'rgba(74, 144, 226, 0.2)'}` }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#6cb2eb' : '#2980b9', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Landmark size={20} /> Projetos (Obras no Mundo)</h3>
                  <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '1rem' }}>Conquistas práticas, estudos, viagens, etc.</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <input type="text" value={newProjectGoal} onChange={(e) => setNewProjectGoal(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') addProjectGoal() }} placeholder="Ex: Terminar a leitura do Bastião X..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    <button onClick={addProjectGoal} style={{ padding: '0 1rem', background: isDark ? '#6cb2eb' : '#2980b9', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}><Plus size={20} /></button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {projectGoals.map(goal => (
                      <div key={goal.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', borderRadius: '8px', border: `1px solid ${goal.completed ? '#4caf50' : (isDark ? 'rgba(74, 144, 226, 0.2)' : '#eee')}` }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', flex: 1 }}>
                          <input type="checkbox" checked={goal.completed} onChange={() => toggleGoal(goal.id, 'project')} style={{ width: '18px', height: '18px', marginTop: '0.2rem', accentColor: isDark ? '#6cb2eb' : '#2980b9' }} />
                          <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', textDecoration: goal.completed ? 'line-through' : 'none', opacity: goal.completed ? 0.6 : 1, lineHeight: '1.4' }}>{goal.text}</span>
                        </label>
                        <button onClick={() => removeGoal(goal.id, 'project')} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '0.2rem' }}><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* BLOCO 3: MISSÕES DE CICLO ATIVAS */}
              {acceptedMissions.length > 0 && (
                <div className="animate-fadeIn" style={{ marginTop: '2rem', padding: '1.5rem', background: isDark ? 'rgba(155, 89, 182, 0.05)' : '#fdf8ff', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.3)' : 'rgba(155, 89, 182, 0.3)'}` }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#c39bd3' : '#8e44ad', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={20} /> Missões em Andamento</h3>
                  <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '1.5rem' }}>Desafios práticos assumidos para forjar a vontade.</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {acceptedMissions.map(missao => (
                      <div key={missao.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1rem', background: missao.completed ? (isDark ? 'rgba(76, 175, 80, 0.1)' : '#f0fdf4') : (isDark ? 'rgba(0,0,0,0.3)' : 'white'), borderRadius: '8px', border: `1px solid ${missao.completed ? '#4caf50' : (isDark ? 'rgba(155, 89, 182, 0.3)' : '#e1bee7')}`, transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
                        
                        {/* EFEITO DE BRILHO SE COMPLETA */}
                        {missao.completed && <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(76,175,80,0.2) 0%, transparent 70%)', borderRadius: '50%' }}></div>}

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer', flex: 1, zIndex: 1 }}>
                          <input type="checkbox" checked={missao.completed} onChange={() => toggleAcceptedMission(missao.id)} style={{ width: '20px', height: '20px', marginTop: '0.1rem', accentColor: '#4caf50' }} />
                          <div style={{ opacity: missao.completed ? 0.7 : 1 }}>
                            <strong style={{ color: missao.completed ? '#4caf50' : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '1.05rem', textDecoration: missao.completed ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              {missao.titulo}
                            </strong>
                            <span style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem', lineHeight: '1.4', display: 'block' }}>{missao.descricao}</span>
                            <span style={{ color: isDark ? '#c39bd3' : '#8e44ad', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.5rem', display: 'block' }}>Assumida em: {missao.startDate.split('-').reverse().join('/')}</span>
                          </div>
                        </label>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', zIndex: 1 }}>
                          <button onClick={() => removeAcceptedMission(missao.id)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '0.2rem' }} title="Abandonar Missão"><X size={18} /></button>
                          
                          {/* SELO DE VITÓRIA */}
                          {missao.completed && (
                            <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.5rem' }}>
                              <Award size={32} color="#FFD700" style={{ filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.5))' }} />
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>Vitória</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* O ORÁCULO FICA AQUI EMBAIXO */}
              <div style={{ borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, marginTop: '2rem', paddingTop: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '1.3rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={22} /> Forja de Missões (IA)
                    </h3>
                    <button onClick={generateAiGoals} disabled={isGeneratingGoals || (virtueGoals.length === 0 && projectGoals.length === 0)} style={{ padding: '0.6rem 1.2rem', background: isGeneratingGoals ? (isDark ? 'rgba(255, 152, 0, 0.15)' : '#fff3e0') : 'transparent', color: isGeneratingGoals ? (isDark ? '#ff9800' : '#e65100') : (isDark ? '#FFD700' : '#996515'), border: `1px solid ${isGeneratingGoals ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? '#FFD700' : '#996515')}`, borderRadius: '8px', cursor: (isGeneratingGoals || (virtueGoals.length === 0 && projectGoals.length === 0)) ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s ease' }}>
                      {isGeneratingGoals ? <Sparkles className="animate-spin" size={16} /> : <Target size={16} />}
                      {isGeneratingGoals ? 'Consultando o Oráculo...' : 'Gerar Missões de Ciclo (15 dias)'}
                    </button>
                  </div>

                  {(virtueGoals.length === 0 && projectGoals.length === 0) && <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>Adicione ao menos um Sonho ou Projeto acima para que a IA possa gerar suas missões cruzadas.</p>}

                  {aiSuggestedGoals && (
                    <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(0,0,0,0.3)' : '#fdfbf7', padding: '1.5rem', borderRadius: '12px', border: `1px dashed ${isDark ? 'rgba(255, 215, 0, 0.4)' : 'rgba(153, 101, 21, 0.3)'}` }}>
                      <p style={{ margin: '0 0 1.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.05rem', lineHeight: '1.6', fontStyle: 'italic', borderLeft: `3px solid ${isDark ? '#FFD700' : '#996515'}`, paddingLeft: '1rem' }}>
                        "{aiSuggestedGoals.conselho}"
                      </p>
                      {/* DISCLAIMER DE SEGURANÇA */}
                      <div style={{ background: isDark ? 'rgba(231, 76, 60, 0.1)' : '#fff5f5', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #e74c3c', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <AlertCircle size={20} color="#e74c3c" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                        <p style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.85rem', lineHeight: '1.5' }}>
                          <strong style={{ color: '#e74c3c' }}>Prudência Filosófica:</strong> Estas missões são sugestões algorítmicas geradas por IA com base em seus textos. A máquina não possui contexto médico ou psicológico completo. Avalie com responsabilidade e bom senso se a missão é segura e adequada à sua realidade antes de assumi-la.
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        {aiSuggestedGoals.missoes.map((missao, idx) => {
                          const isAccepted = acceptedMissions.some(m => m.titulo === missao.titulo);
                          return (
                            <div key={idx} style={{ 
                              background: isAccepted ? (isDark ? 'rgba(76, 175, 80, 0.05)' : 'rgba(76, 175, 80, 0.1)') : (isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)'), 
                              padding: '1rem', 
                              borderRadius: '8px', 
                              border: `1px solid ${isAccepted ? (isDark ? 'rgba(76, 175, 80, 0.3)' : '#4caf50') : (isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)')}`, 
                              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                              opacity: isAccepted ? 0.6 : 1,
                              transition: 'all 0.3s ease'
                            }}>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: isAccepted ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#d4af37' : '#6b4423'), fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {isAccepted ? <CheckCircle size={16} /> : <Flame size={16} />} {missao.titulo}
                                </h4>
                                <p style={{ margin: '0 0 1rem 0', color: isDark ? '#c8b896' : '#6b5744', fontSize: '0.9rem', lineHeight: '1.5' }}>{missao.descricao}</p>
                              </div>
                              <button 
                                onClick={() => !isAccepted && setMissionToAccept(missao)} 
                                disabled={isAccepted}
                                style={{ 
                                  alignSelf: 'flex-start', padding: '0.5rem 1rem', 
                                  background: isAccepted ? (isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9') : 'transparent', 
                                  color: isAccepted ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#FFD700' : '#996515'), 
                                  border: `1px solid ${isAccepted ? (isDark ? 'rgba(76, 175, 80, 0.5)' : '#4caf50') : (isDark ? '#FFD700' : '#996515')}`, 
                                  borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', 
                                  cursor: isAccepted ? 'not-allowed' : 'pointer', 
                                  display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s' 
                                }} 
                                onMouseOver={(e) => !isAccepted && (e.currentTarget.style.background = isDark ? 'rgba(255,215,0,0.1)' : 'rgba(153,101,21,0.1)')} 
                                onMouseOut={(e) => !isAccepted && (e.currentTarget.style.background = 'transparent')}
                              >
                                {isAccepted ? <CheckCircle size={14} /> : <Shield size={14} />} 
                                {isAccepted ? 'Missão Assumida' : 'Aceitar Missão'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>

              {/* MODAL DE JURAMENTO (POP-UP) */}
              {missionToAccept && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
                  <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2.5rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                    <Shield size={56} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1rem' }} />
                    <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.6rem' }}>Juramento de Missão</h2>
                    
                    <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.5)', padding: '1.5rem', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#FFD700' : '#996515'}`, marginBottom: '1.5rem', textAlign: 'left' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.1rem' }}>{missionToAccept.titulo}</h4>
                      <p style={{ margin: 0, color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.95rem', lineHeight: '1.5' }}>{missionToAccept.descricao}</p>
                    </div>

                    <p style={{ margin: '0 0 2rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem', fontStyle: 'italic', fontWeight: 'bold', lineHeight: '1.6' }}>
                      "Eu me comprometo comigo mesmo a trabalhar por esse objetivo, não por vaidade, mas pela minha própria lapidação interior."
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button onClick={confirmAcceptMission} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <CheckCircle size={20} /> Assumir a Missão
                      </button>
                      <button onClick={() => setMissionToAccept(null)} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#b8a88a' : '#6b4423', border: 'none', fontSize: '1rem', cursor: 'pointer', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>
                        Recuar
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* VIEW: LEITURAS E ESTUDOS */}
        {view === 'leituras' && (
          <div className="animate-fadeIn">
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <label style={{ cursor: 'pointer', background: 'transparent', color: isDark ? '#b8a88a' : '#6b5744', border: `1px solid ${isDark ? '#b8a88a' : '#6b5744'}`, padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                        <Camera size={16} /> Escanear Estante
                        <input type="file" accept="image/*" capture="environment" onChange={handleShelfScan} style={{ display: 'none' }} />
                      </label>
                      <button onClick={() => setShowAddBook(true)} style={{ background: isDark ? '#FFD700' : '#996515', color: isDark ? '#000' : '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Novo Livro
                      </button>
                    </div>
              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>
                "Um quarto sem livros é como um corpo sem alma." — Cícero
              </p>
              
                {/* DASHBOARD DE GAMIFICAÇÃO: O CAMINHO DO SÁBIO */}
              {(() => {
                const rank = getReadingRank(totalForgedPages);
                const progressToNext = rank.next ? Math.min(100, Math.round((totalForgedPages / rank.next) * 100)) : 100;
                
                return (
                  <div className="animate-fadeIn" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    
                    {/* CARD DO RANK */}
                    <div style={{ background: isDark ? 'rgba(0,0,0,0.3)' : '#fcfcfc', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : '#eee'}`, display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: `3px solid ${rank.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : 'white', boxShadow: `0 0 15px ${rank.color}40` }}>
                        <Award size={36} color={rank.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: isDark ? '#b8a88a' : '#888', fontWeight: 'bold' }}>Seu Grau na Escola</span>
                        <h3 style={{ margin: '0.2rem 0 0.5rem 0', fontFamily: "'Cinzel', serif", fontSize: '1.4rem', color: rank.color }}>{rank.title}</h3>
                        
                        {rank.next ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isDark ? '#f0e6d2' : '#2c1810', marginBottom: '0.3rem', fontWeight: 'bold' }}>
                              <span>Páginas Forjadas: {totalForgedPages}</span>
                              <span>Rumo a {rank.next}</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${progressToNext}%`, height: '100%', background: rank.color, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                            </div>
                          </>
                        ) : (
                          <div style={{ color: rank.color, fontSize: '0.85rem', fontWeight: 'bold', marginTop: '0.5rem' }}>Você alcançou o cume da Sabedoria Literária.</div>
                        )}
                      </div>
                    </div>

                    {/* NOVO PAINEL DE MÉTRICAS DETALHADO */}
                    <div style={{ background: isDark ? 'rgba(212,175,55,0.05)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                      
                      {/* Obras Lidas */}
                      <div style={{ textAlign: 'center', borderRight: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}`, borderBottom: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}`, paddingBottom: '0.5rem' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515' }}>
                          {books.length}
                        </div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: isDark ? '#b8a88a' : '#6b5744', fontWeight: 'bold' }}>Na Estante</div>
                      </div>

                      {/* Concluídos */}
                      <div style={{ textAlign: 'center', borderBottom: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}`, paddingBottom: '0.5rem' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif", color: '#4caf50' }}>
                          {finishedBooksCount}
                        </div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: isDark ? '#b8a88a' : '#6b5744', fontWeight: 'bold' }}>Concluídos</div>
                      </div>

                      {/* Tema Frequente */}
                      <div style={{ textAlign: 'center', borderRight: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}`, paddingTop: '0.5rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isDark ? '#f0e6d2' : '#2c1810', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 0.5rem' }}>
                          {favoriteTheme}
                        </div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: isDark ? '#b8a88a' : '#6b5744', fontWeight: 'bold', marginTop: '0.2rem' }}>Tema Frequente</div>
                      </div>

                      {/* Taxa de Finalização */}
                      <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                          {books.length > 0 ? Math.round((finishedBooksCount / books.length) * 100) : 0}%
                        </div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: isDark ? '#b8a88a' : '#6b5744', fontWeight: 'bold', marginTop: '0.2rem' }}>Taxa de Conclusão</div>
                      </div>

                    </div>

                  </div>
                );
              })()}
              



              {/* FORMULÁRIO DE ADICIONAR/EDITAR LIVRO (COM BUSCA GOOGLE) */}
              {showAddBook && (
                <div style={{ padding: '1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '12px', marginBottom: '2rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif" }}>{editingBookId ? 'Editar Livro' : 'Adicionar à Estante'}</h3>
                    <button onClick={() => { setShowAddBook(false); setBookSearchResults([]); setBookSearchQuery(''); }} style={{ background: 'transparent', color: '#e74c3c', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                  </div>
                  
                  {/* BARRA DE PESQUISA GOOGLE (Só aparece se for novo livro) */}
                  {!editingBookId && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          value={bookSearchQuery} 
                          onChange={(e) => setBookSearchQuery(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && searchBooks(bookSearchQuery)}
                          placeholder="Pesquise por título ou autor..." 
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, background: isDark ? 'rgba(0,0,0,0.2)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} 
                        />
                        <button onClick={() => searchBooks(bookSearchQuery)} style={{ padding: '0 1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                          {isSearchingBooks ? <Sparkles className="animate-spin" size={18}/> : <Search size={18}/>}
                        </button>
                      </div>

                      {/* RESULTADOS DA BUSCA */}
                      {bookSearchResults.length > 0 && (
                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', borderRadius: '8px', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                          {bookSearchResults.map(res => (
                            <div 
                              key={res.id} 
                              onClick={() => {
                                setNewBook({ title: res.title, author: res.author, currentPage: 0, totalPages: res.totalPages, thumbnail: res.thumbnail, category: res.category });
                                setBookSearchResults([]);
                                setBookSearchQuery('');
                              }}
                              style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '6px', borderBottom: isDark ? '1px solid #333' : '1px solid #eee' }}
                              onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f9f9f9'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <img src={res.thumbnail || 'https://via.placeholder.com/40x60?text=No+Cover'} alt="Capa" style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                              <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isDark ? '#f0e6d2' : '#2c1810' }}>{res.title}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>{res.author}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* FORMULÁRIO FINAL (Preenchido ou Manual) */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.2rem' }}>Título</label>
                      <input type="text" value={newBook.title} onChange={(e) => setNewBook({...newBook, title: e.target.value})} placeholder="Título..." style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.2rem' }}>Autor</label>
                      <input type="text" value={newBook.author} onChange={(e) => setNewBook({...newBook, author: e.target.value})} placeholder="Autor..." style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#888' }}>Pág. Atual</label>
                      <input type="number" value={newBook.currentPage} onChange={(e) => setNewBook({...newBook, currentPage: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#888' }}>Total Págs</label>
                      <input type="number" value={newBook.totalPages} onChange={(e) => setNewBook({...newBook, totalPages: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#888' }}>Tema/Categoria</label>
                      <input type="text" value={newBook.category || ''} onChange={(e) => setNewBook({...newBook, category: e.target.value})} placeholder="Ex: Estoicismo" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                  </div>

                  {/* Atalho para Livro Já Lido - Salvamento Imediato */}
                  {!editingBookId && newBook.totalPages > 0 && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button 
                        onClick={() => {
                          const finishedBook = { 
                            ...newBook, 
                            currentPage: newBook.totalPages, 
                            finishedDate: new Date().toISOString() 
                          };
                          
                          // Colocamos o novo livro na FRENTE do array ([novo, ...antigos])
                          const updated = [{ id: `book_${Date.now()}`, ...finishedBook }, ...books];

                          saveBooksToDb(updated);
                          
                          // Fecha sem popup, a aparição no topo é a confirmação
                          setShowAddBook(false);
                          setBookSearchQuery('');
                          setNewBook({ title: '', author: '', currentPage: 0, totalPages: 0 });
                        }}
                        style={{ background: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9', color: isDark ? '#81c784' : '#2e7d32', border: `2px solid ${isDark ? '#4caf50' : '#4caf50'}`, padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}
                      >
                        <CheckCircle size={18} /> Marcar como Já Lido e Guardar na Estante
                      </button>
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      if(!newBook.title) return alert('Dê um título ao livro.');
                      
                      let updated;
                      if (editingBookId) {
                        // Se estiver editando, mantém a posição original
                        updated = books.map(b => b.id === editingBookId ? { ...b, ...newBook } : b);
                      } else {
                        // Se for novo, coloca no TOPO da lista
                        updated = [{ id: `book_${Date.now()}`, ...newBook, finishedDate: null }, ...books];
                      }
                      
                      saveBooksToDb(updated);
                      setShowAddBook(false);
                      setBookSearchQuery('');
                      setNewBook({ title: '', author: '', currentPage: 0, totalPages: 0 });
                      setEditingBookId(null);
                    }}
                    style={{ width: '100%', padding: '0.75rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '1rem' }}
                  >
                    <Save size={18} style={{ marginRight: '0.5rem' }}/> {editingBookId ? 'Salvar Alterações' : 'Guardar na Estante'}
                  </button>
                </div>
              )}

              {/* VITRINE DE RECOMENDAÇÃO (MONETIZAÇÃO) */}
              {books.length > 0 && (
                <div style={{ marginBottom: '3rem', padding: '1.5rem', background: isDark ? 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(0,0,0,0.3) 100%)' : 'linear-gradient(135deg, #fffbf0 0%, #fff 100%)', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212,175,55,0.3)' : '#ffe082'}`, position: 'relative', overflow: 'hidden' }}>
                  {!bookRecommendation ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <Sparkles className="animate-spin" size={24} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1rem' }} />
                      <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem', fontStyle: 'italic' }}>O Oráculo está consultando os astros e sua estante para encontrar a próxima jornada...</p>
                    </div>
                  ) : (
                    <div className="animate-fadeIn" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '0.6rem', color: isDark ? '#555' : '#ccc', textTransform: 'uppercase' }}>Sugestão do Oráculo</div>
                      
                      <img src={bookRecommendation.thumbnail || 'https://placehold.co/60x90/1a1a2e/d4af37?text=Capa'} alt="Capa" style={{ width: '70px', height: '100px', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }} />
                      
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <h4 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif", fontSize: '1.1rem' }}>{bookRecommendation.title}</h4>
                        <p style={{ margin: '0.2rem 0 0.75rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.85rem' }}>de {bookRecommendation.author}</p>
                        <p style={{ margin: 0, color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: '1.4' }}>"{bookRecommendation.reason}"</p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <a 
                          href={`https://www.amazon.com.br/s?k=${encodeURIComponent(bookRecommendation.title + ' ' + bookRecommendation.author)}&tag=${AMAZON_AFFILIATE_ID}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ padding: '0.8rem 1.5rem', background: '#FF9900', color: '#000', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(255,153,0,0.3)' }}
                        >
                          Comprar na Amazon
                        </a>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button onClick={generateBookRecommendation} disabled={isGeneratingRecommendation} style={{ flex: 1, background: 'transparent', border: `1px solid ${isDark ? '#555' : '#ccc'}`, color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', padding: '0.4rem', transition: 'all 0.2s' }}>{isGeneratingRecommendation ? 'Gerando...' : 'Já Li (Gerar Nova)'}</button>
                          <button onClick={generateBookRecommendation} disabled={isGeneratingRecommendation} style={{ flex: 1, background: 'transparent', border: `1px solid ${isDark ? '#555' : '#ccc'}`, color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', padding: '0.4rem', transition: 'all 0.2s' }}>{isGeneratingRecommendation ? 'Gerando...' : 'Sem interesse'}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* A ESTANTE DE LIVROS */}
              {books.length === 0 && !showAddBook ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: isDark ? '#b8a88a' : '#6b5744' }}>
                  <Bookmark size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '1.1rem' }}>Sua estante está vazia. Adicione o livro que está lendo.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {[...books].sort((a, b) => {
                    const aTerminado = a.totalPages > 0 && a.currentPage >= a.totalPages;
                    const bTerminado = b.totalPages > 0 && b.currentPage >= b.totalPages;
                    if (aTerminado === bTerminado) return 0;
                    return aTerminado ? 1 : -1; // Concluídos descem, em andamento sobem
                  }).map(book => {
                    const progress = book.totalPages > 0 ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100)) : 0;
                    const isFinished = progress >= 100;
                    
                    return (
                      <div key={book.id} style={{ background: isFinished ? (isDark ? 'rgba(76, 175, 80, 0.05)' : '#f0fdf4') : (isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)'), border: `1px solid ${isFinished ? '#4caf50' : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}`, borderRadius: '12px', padding: '1.2rem', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem' }}>
                        
                        {/* CAPA DO LIVRO */}
                        <div style={{ flexShrink: 0, width: '80px', height: '120px', background: '#333', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                          <img src={book.thumbnail || 'https://placehold.co/80x120/1a1a2e/d4af37?text=Sem+Capa'} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", lineHeight: '1.2' }}>{book.title}</h3>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => { setEditingBookId(book.id); setNewBook(book); setShowAddBook(true); window.scrollTo(0,0); }} style={{ background: 'transparent', border: 'none', color: isDark ? '#d4af37' : '#6b4423', cursor: 'pointer' }}><Edit size={14} /></button>
                              <button onClick={() => { if(window.confirm('Remover da estante?')) saveBooksToDb(books.filter(b => b.id !== book.id)); }} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><Trash2 size={14} /></button>
                            </div>
                          </div>
                          
                          <p style={{ margin: '0.2rem 0 0.5rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.85rem', fontStyle: 'italic' }}>{book.author}</p>
                          
                          {/* TAG DE CATEGORIA */}
                          {book.category && (
                            <span style={{ alignSelf: 'flex-start', fontSize: '0.65rem', padding: '2px 6px', background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: '4px', color: isDark ? '#d4af37' : '#6b4423', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>{book.category}</span>
                          )}

                          {/* PROGRESSO */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.3rem' }}>
                            <span>{progress}% concluído</span>
                            {isFinished && <span style={{ color: '#4caf50' }}>Lido em {book.finishedDate ? new Date(book.finishedDate).toLocaleDateString('pt-BR') : ''}</span>}
                          </div>
                          <div style={{ width: '100%', height: '6px', background: isDark ? 'rgba(255,255,255,0.1)' : '#eee', borderRadius: '3px', overflow: 'hidden', marginBottom: '1rem' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: isFinished ? '#4caf50' : (isDark ? '#d4af37' : '#6b4423'), transition: 'width 0.8s ease' }}></div>
                          </div>

                          {!isFinished ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button 
                                onClick={() => {
                                const inputPagina = prompt(`Livro: ${book.title}\nTotal de páginas: ${book.totalPages}\n\nEm qual página você parou hoje?`, book.currentPage);
                                
                                if (inputPagina && !isNaN(inputPagina)) {
                                  const novaPaginaInformada = parseInt(inputPagina);
                                  
                                  if (novaPaginaInformada <= book.currentPage) {
                                    alert("A página informada é menor ou igual à atual. Nenhuma página nova forjada.");
                                    return;
                                  }

                                  const novaPag = Math.min(book.totalPages, novaPaginaInformada);
                                  const acabouAgora = (novaPag >= book.totalPages);
                                  
                                  const paginasAvançadasReais = novaPag - book.currentPage;
                                  const novoTotalGlobal = totalForgedPages + paginasAvançadasReais;

                                  const livroAtualizado = { ...book, currentPage: novaPag, finishedDate: acabouAgora ? new Date().toISOString() : null };

                                  saveBooksToDb(books.map(b => b.id === book.id ? livroAtualizado : b), novoTotalGlobal);

                                  if (acabouAgora) {
                                    alert(`Vitória! Você concluiu "${book.title}". O conhecimento agora faz parte de você.`);
                                  } else if (paginasAvançadasReais > 0) {
                                    // REQ 6: Dispara o convite e a IA de sugestões!
                                    setPostReadInvite(livroAtualizado);
                                    if(aiConsent) generateTopicsForInvite(livroAtualizado);
                                  }
                                }
                              }}
                                style={{ flex: 1, padding: '0.5rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : '#ccc'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                              >
                                + Atualizar
                              </button>
                              <button 
                                onClick={() => runSocraticTutor(book)}
                                style={{ flex: 1, padding: '0.5rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Sparkles size={12} /> Socrático
                              </button>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: '#4caf50', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid #4caf50', borderRadius: '6px', padding: '0.4rem' }}>
                              <Award size={14} /> Leitura Finalizada
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODAL DO TUTOR SOCRÁTICO */}
              {activeBookForAi && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
                  <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '500px', width: '100%', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
                    <button onClick={() => setActiveBookForAi(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={24} /></button>
                    
                    <MessageCircle size={40} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1rem', display: 'block' }} />
                    <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.4rem', textAlign: 'center' }}>Tutor Socrático</h3>
                    <p style={{ margin: '0 0 1.5rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem', textAlign: 'center', fontStyle: 'italic' }}>Livro: {activeBookForAi.title} (Pág. {activeBookForAi.currentPage})</p>

                    {!bookAiInsight ? (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Sparkles className="animate-spin" size={32} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1rem' }} />
                        <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>O Tutor está folheando as páginas que você leu para extrair uma reflexão...</p>
                      </div>
                    ) : (
                      <div className="animate-fadeIn">
                        <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.1)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', borderLeft: `4px solid ${isDark ? '#FFD700' : '#996515'}`, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.05rem', lineHeight: '1.6', fontFamily: 'Georgia, serif', marginBottom: '2rem' }} dangerouslySetInnerHTML={{ __html: bookAiInsight }}>
                        </div>
                        <button 
                                onClick={() => runSocraticTutor(book)}
                                style={{ flex: 1, padding: '0.5rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Sparkles size={12} /> Socrático
                              </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL DE CONVITE PÓS-LEITURA (REQ 6) */}
              {postReadInvite && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
                  <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                    <MessageCircle size={48} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.4rem' }}>Páginas Forjadas!</h3>
                    <p style={{ margin: '0 0 1.5rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.95rem', lineHeight: '1.5' }}>
                      Você avançou na leitura de "{postReadInvite.title}". Deseja solidificar o que aprendeu conversando com o Tutor Socrático?
                    </p>

                    {!aiConsent ? (
                      <p style={{ color: '#e74c3c', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '1.5rem' }}>Autorize a IA nas configurações para receber sugestões de reflexão.</p>
                    ) : isGeneratingTopics ? (
                      <div style={{ padding: '1.5rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        <Sparkles className="animate-spin" size={24} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 0.5rem' }} />
                        <span style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>O Tutor está folheando as páginas que você leu...</span>
                      </div>
                    ) : inviteTopics ? (
                      <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <p style={{ fontSize: '0.85rem', color: isDark ? '#d4af37' : '#996515', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Tópicos sugeridos das suas páginas:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {inviteTopics.map((topic, idx) => (
                            <button 
                              key={idx}
                              onClick={() => {
                                setBookUserNote(topic); // Pré-preenche a dúvida
                                setActiveBookForAi(postReadInvite); // Abre o Socrático
                                setPostReadInvite(null); // Fecha o convite
                              }}
                              style={{ textAlign: 'left', padding: '0.75rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : '#fffbf0', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, borderRadius: '8px', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                              onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = isDark ? 'rgba(212, 175, 55, 0.1)' : '#fffbf0'}
                            >
                              <Target size={14} color={isDark ? '#FFD700' : '#996515'} style={{ flexShrink: 0 }} /> {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={() => setPostReadInvite(null)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', color: isDark ? '#b8a88a' : '#6b4423', border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Apenas Guardar
                      </button>
                      <button 
                        onClick={() => { 
                          setPostReadInvite(null); 
                          runSocraticTutor(postReadInvite); 
                        }} 
                        style={{ flex: 1, padding: '0.8rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Refletir Livremente
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL DO ESCANER DE ESTANTE (FASE 4) */}
              {showScannerModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
                  <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '500px', width: '100%', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Camera size={24} /> Olho de Argos
                      </h3>
                      <button onClick={() => setShowScannerModal(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={24} /></button>
                    </div>

                    {isScanningShelf ? (
                      <div style={{ padding: '3rem 0' }}>
                        <Sparkles className="animate-spin" size={48} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1.5rem' }} />
                        <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1rem', fontStyle: 'italic' }}>
                          O Oráculo está lendo as lombadas na sua foto... <br/>Isso pode levar alguns segundos.
                        </p>
                      </div>
                    ) : detectedBooks.length > 0 ? (
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ color: isDark ? '#f0e6d2' : '#2c1810', marginBottom: '1rem' }}>Os seguintes tomos foram revelados na imagem. Clique para adicioná-los à busca para registro:</p>
                        
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          {detectedBooks.map((b, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '1rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, alignItems: 'center' }}>
                              
                              {/* CAPA PUXADA AUTOMATICAMENTE */}
                              <img src={b.thumbnail || 'https://placehold.co/60x90/1a1a2e/d4af37?text=Capa'} alt="Capa" style={{ width: '60px', height: '90px', borderRadius: '6px', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
                              
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <h4 style={{ margin: '0 0 0.2rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.05rem', lineHeight: '1.2' }}>{b.title}</h4>
                                <span style={{ fontSize: '0.8rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block', marginBottom: '0.5rem' }}>{b.author} • {b.totalPages > 0 ? `${b.totalPages} págs` : 'Páginas Indefinidas'}</span>
                                
                                {/* BOTÕES ÁGEIS */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => handleQuickAdd(b, 'lido')} style={{ flex: 1, minWidth: '70px', background: isDark ? '#4caf50' : '#2e7d32', color: 'white', border: 'none', padding: '0.4rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>Já Li</button>
                                  <button onClick={() => handleQuickAdd(b, 'lendo')} style={{ flex: 1, minWidth: '70px', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', padding: '0.4rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>Lendo</button>
                                  <button onClick={() => handleQuickAdd(b, 'quero')} style={{ flex: 1, minWidth: '70px', background: 'transparent', color: isDark ? '#b8a88a' : '#6b5744', border: `1px solid ${isDark ? '#b8a88a' : '#ccc'}`, padding: '0.4rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>Quero Ler</button>
                                </div>
                              </div>
                              
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: '#e74c3c' }}>Nenhum livro pôde ser lido. Tente melhorar a iluminação ou chegar mais perto da estante.</p>
                    )}
                  </div>
                </div>
              )}

        {/* VIEW: BIBLIOTECA */}
        {view === 'biblioteca' && (
          <div className="animate-fadeIn">
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Book size={32} color={isDark ? '#d4af37' : '#6b4423'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>Biblioteca de Virtudes</h2>
              </div>
              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem' }}>Conheça as virtudes que estamos estudando e suas práticas</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {virtues.map((virtue, index) => (
                  <div key={index} onClick={() => setSelectedVirtueDetail(selectedVirtueDetail === virtue.name ? null : virtue.name)} style={{ padding: '1.5rem', background: selectedVirtueDetail === virtue.name ? (isDark ? `${virtue.color}20` : `${virtue.color}15`) : (isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)'), border: `2px solid ${selectedVirtueDetail === virtue.name ? virtue.color : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}`, borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.3rem', color: virtue.color, fontFamily: "'Cinzel', serif" }}>{virtue.name}</h3>
                    <p style={{ fontSize: '0.95rem', color: isDark ? '#c8b896' : '#6b5744', margin: '0 0 1rem 0', fontStyle: 'italic' }}>{virtue.shortDesc}</p>
                    {selectedVirtueDetail === virtue.name && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                        <p style={{ fontSize: '1rem', color: isDark ? '#f0e6d2' : '#2c1810', marginBottom: '1rem', lineHeight: '1.7' }}>{virtue.description}</p>
                        <div style={{ padding: '1rem', background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'rgba(255, 255, 255, 0.5)', borderRadius: '8px' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: virtue.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Práticas Sugeridas:</h4>
                          <p style={{ fontSize: '0.95rem', color: isDark ? '#c8b896' : '#6b5744', margin: 0, lineHeight: '1.8', whiteSpace: 'pre-line' }}>{virtue.practices}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: ANALYTICS (Métricas da Alma) */}
        {view === 'analytics' && (
          <div className="animate-fadeIn">
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <TrendingUp size={32} color={isDark ? '#d4af37' : '#6b4423'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>Métricas da Alma</h2>
              </div>
              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem' }}>Observe seus padrões de comportamento e a constância do seu autoexame.</p>

              {entries.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: isDark ? 'rgba(26, 26, 46, 0.4)' : '#fdfbf7', borderRadius: '12px' }}>
                  <TrendingUp size={48} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem' }}>Ainda não há dados suficientes para gerar métricas. Continue forjando seu diário!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                   {(() => {
                      const total = entries.length;
                      const morningCount = entries.filter(e => e.morningDone).length;
                      const eveningCount = entries.filter(e => e.eveningDone).length;

                      // Calcula as Virtudes Mais Invocadas
                      const virtueCounts = {};
                      entries.forEach(e => {
                         if(e.virtue) virtueCounts[e.virtue] = (virtueCounts[e.virtue] || 0) + 1;
                      });
                      const topVirtues = Object.entries(virtueCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

                      // ==========================================
                      // LÓGICA DE COMPARAÇÃO DOS CICLOS (30 DIAS)
                      // ==========================================
                      const hoje = new Date();
                      const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(hoje.getDate() - 30);
                      const sessentaDiasAtras = new Date(); sessentaDiasAtras.setDate(hoje.getDate() - 60);

                      const cicloAtual = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= trintaDiasAtras && d <= hoje; });
                      const cicloAnterior = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= sessentaDiasAtras && d < trintaDiasAtras; });

                      const countCustomTasks = (ciclo) => ciclo.reduce((acc, curr) => acc + (curr.tasksSnapshot ? curr.tasksSnapshot.filter(t => t.completed).length : 0), 0);

                      const preenchimentosAtual = cicloAtual.length;
                      const preenchimentosAnterior = cicloAnterior.length;
                      const varPreenchimentos = preenchimentosAnterior === 0 ? 100 : Math.round(((preenchimentosAtual - preenchimentosAnterior) / preenchimentosAnterior) * 100);

                      const tarefasAtual = countCustomTasks(cicloAtual);
                      const tarefasAnterior = countCustomTasks(cicloAnterior);
                      const varTarefas = tarefasAnterior === 0 ? 100 : Math.round(((tarefasAtual - tarefasAnterior) / tarefasAnterior) * 100);

                      return (
                        <>
                          {/* CARDS DE VISÃO GERAL (NOVO FORMATO DASHBOARD) */}
                          <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.3)'}`, marginBottom: '2rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={18} /> Resumo do Ciclo (30 dias)</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                              
                              {/* Card 1: Preenchimentos */}
                              <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : '#ccc'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>Dias Forjados</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>{preenchimentosAtual}</span>
                                  <span style={{ fontSize: '1rem', color: isDark ? '#888' : '#999' }}>/ 30</span>
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: varPreenchimentos >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: varPreenchimentos >= 0 ? (isDark ? '#81c784' : '#2e7d32') : '#e74c3c', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {varPreenchimentos >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                                  {varPreenchimentos > 0 ? '+' : ''}{varPreenchimentos}%
                                </div>
                              </div>

                              {/* Card 2: Tarefas Personalizadas */}
                              <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : '#ccc'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>Tarefas Realizadas</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>{tarefasAtual}</span>
                                  <span style={{ fontSize: '1rem', color: isDark ? '#888' : '#999' }}>ações</span>
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: varTarefas >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: varTarefas >= 0 ? (isDark ? '#81c784' : '#2e7d32') : '#e74c3c', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {varTarefas >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                                  {varTarefas > 0 ? '+' : ''}{varTarefas}%
                                </div>
                              </div>

                            </div>
                          </div>

                          {/* GRÁFICO DE BARRAS DAS VIRTUDES */}
                          <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'white', padding: '2rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                            <h3 style={{ margin: '0 0 1.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>Virtudes Mais Invocadas</h3>
                            {topVirtues.length > 0 ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                 {topVirtues.map(([vName, vCount]) => {
                                    const percentage = Math.round((vCount / total) * 100);
                                    return (
                                      <div key={vName}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.95rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>
                                          <span>{vName}</span>
                                          <span style={{ color: isDark ? '#d4af37' : '#6b4423' }}>{vCount} vezes ({percentage}%)</span>
                                        </div>
                                        <div style={{ width: '100%', height: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', borderRadius: '6px', overflow: 'hidden' }}>
                                          <div style={{ width: `${percentage}%`, height: '100%', background: isDark ? 'linear-gradient(90deg, #b8a88a 0%, #d4af37 100%)' : 'linear-gradient(90deg, #8b7355 0%, #6b4423 100%)', borderRadius: '6px', transition: 'width 1s ease-out' }}></div>
                                        </div>
                                      </div>
                                    );
                                 })}
                               </div>
                            ) : (
                               <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic', fontSize: '0.95rem', margin: 0 }}>Nenhuma virtude registrada nas suas anotações matinais.</p>
                            )}
                          </div>

                          {/* PAINEL DE AUDITORIA ESTATÍSTICA (IA) */}
                          <div style={{ background: isDark ? 'rgba(0,0,0,0.3)' : '#f8f9fa', padding: '2rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.3)' : 'rgba(74, 144, 226, 0.3)'}`, marginTop: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                              <div>
                                <h3 style={{ margin: 0, color: isDark ? '#6cb2eb' : '#2980b9', fontSize: '1.4rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Sparkles size={24} /> Auditoria do Ciclo
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', margin: '0.5rem 0 0 0', fontStyle: 'italic' }}>Cruzamento analítico de dados estruturados e reflexões livres.</p>
                              </div>
                              <button onClick={generateTechnicalSynthesis} disabled={isGeneratingSynthesis} style={{ 
                                padding: '0.8rem 1.5rem', 
                                background: isGeneratingSynthesis ? (isDark ? 'rgba(255, 152, 0, 0.15)' : '#fff3e0') : (technicalSynthesis ? (isDark ? 'rgba(39, 174, 96, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(74, 144, 226, 0.1)' : 'rgba(74, 144, 226, 0.1)')), 
                                color: isGeneratingSynthesis ? (isDark ? '#ff9800' : '#e65100') : (technicalSynthesis ? (isDark ? '#2ecc71' : '#27ae60') : (isDark ? '#6cb2eb' : '#2980b9')), 
                                border: `2px solid ${isGeneratingSynthesis ? (isDark ? '#ff9800' : '#ffb74d') : (technicalSynthesis ? (isDark ? '#2ecc71' : '#27ae60') : '#4A90E2')}`, 
                                borderRadius: '8px', cursor: isGeneratingSynthesis ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s ease', fontSize: '1.05rem'
                              }}>
                                {isGeneratingSynthesis ? <Sparkles className="animate-spin" size={18} /> : (technicalSynthesis ? <CheckCircle size={18} /> : <Target size={18} />)}
                                {isGeneratingSynthesis ? 'Processando Dados...' : (technicalSynthesis ? 'Refazer Auditoria' : 'Gerar Auditoria')}
                              </button>
                            </div>

                            <div style={{ background: isDark ? 'rgba(231, 76, 60, 0.1)' : 'rgba(231, 76, 60, 0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #e74c3c', marginBottom: '2rem' }}>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.5', fontStyle: 'italic' }}>
                                <strong>Aviso Importante:</strong> Esta auditoria utiliza Inteligência Artificial. Ela mapeia o passado para que você construa o futuro. Confirme os padrões com seu instrutor.
                              </p>
                            </div>

                            {technicalSynthesis ? (
                              <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                
                                {/* CAIXA 1: A GUARDA BAIXOU */}
                                <div style={{ background: isDark ? 'rgba(231, 76, 60, 0.05)' : '#fff5f5', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(231, 76, 60, 0.3)' : 'rgba(231, 76, 60, 0.3)'}` }}>
                                  <h4 style={{ margin: '0 0 0.75rem 0', color: isDark ? '#e74c3c' : '#c0392b', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target size={18} /> Onde a Guarda Baixou</h4>
                                  <p style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem', lineHeight: '1.6' }}>{aiGuarda}</p>
                                </div>

                                {/* CAIXA 2: CONQUISTAS */}
                                <div style={{ background: isDark ? 'rgba(76, 175, 80, 0.05)' : '#f8fff8', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.3)'}` }}>
                                  <h4 style={{ margin: '0 0 0.75rem 0', color: isDark ? '#81c784' : '#2e7d32', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={18} /> Conquistas Forjadas</h4>
                                  <p style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem', lineHeight: '1.6' }}>{aiConquistas}</p>
                                </div>

                                {/* CAIXA 3: INVESTIGAÇÕES */}
                                <div style={{ background: isDark ? 'rgba(156, 39, 176, 0.05)' : '#faf5ff', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(156, 39, 176, 0.3)' : 'rgba(156, 39, 176, 0.3)'}` }}>
                                  <h4 style={{ margin: '0 0 0.75rem 0', color: isDark ? '#c39bd3' : '#8e44ad', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Search size={18} /> Investigações e Padrões</h4>
                                  <p style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem', lineHeight: '1.6' }}>{aiInvestigacoes}</p>
                                </div>

                                {/* CAIXA 4: SÍNTESE GERAL */}
                                <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.3)' : '#ccc'}`, whiteSpace: 'pre-wrap', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', lineHeight: '1.7', fontFamily: 'Georgia, serif' }}>
                                  <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#6cb2eb' : '#2980b9', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>Relatório Técnico Geral</h4>
                                  {technicalSynthesis}
                                </div>

                                {/* BLOCO DE AVALIAÇÃO DA SÍNTESE */}
                                <div style={{ marginTop: '1rem', padding: '1.5rem', background: isDark ? 'rgba(0,0,0,0.2)' : '#fdfbf7', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, textAlign: 'center' }}>
                                  {feedbackSubmitted ? (
                                    <p style={{ color: isDark ? '#81c784' : '#2e7d32', fontWeight: 'bold', margin: 0 }}>✓ Avaliação enviada anonimamente. Obrigado por ajudar a calibrar o sistema!</p>
                                  ) : (
                                    <>
                                      <p style={{ margin: '0 0 1rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', fontWeight: 'bold' }}>Esta síntese foi útil e precisa?</p>
                                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <button key={star} onClick={() => setFeedbackRating(star)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                                            <Star size={28} fill={feedbackRating >= star ? (isDark ? '#FFD700' : '#FFB300') : 'none'} color={feedbackRating >= star ? (isDark ? '#FFD700' : '#FFB300') : (isDark ? '#555' : '#ccc')} />
                                          </button>
                                        ))}
                                      </div>
                                      {feedbackRating > 0 && (
                                        <div className="animate-fadeIn">
                                          <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Opcional: Por que você deu esta nota? A IA foi precisa?" rows={3} style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', marginBottom: '1rem' }} />
                                          <button 
                                            onClick={() => submitSynthesisFeedback("Aberta")} 
                                            disabled={isSubmittingFeedback}
                                            style={{ padding: '0.6rem 1.5rem', background: isSubmittingFeedback ? (isDark ? '#555' : '#ccc') : (isDark ? '#d4af37' : '#6b4423'), color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: isSubmittingFeedback ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontFamily: 'Georgia, serif', transition: 'all 0.2s' }}
                                          >
                                            {isSubmittingFeedback ? 'Enviando...' : 'Enviar Avaliação Anônima'}
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                              </div>
                            ) : (
                              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic', textAlign: 'center', margin: '3rem 0' }}>Os dados do seu ciclo aguardam processamento. Clique no botão acima para compilar seu dossiê.</p>
                            )}
                          </div>
                        </>
                      );
                   })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: FV */}
        {view === 'fv' && fvUnlocked && (
          <div className="animate-fadeIn">
            {isDownloadingConfig ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                <Sparkles className="animate-spin" size={48} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                  Sincronizando Módulo Avançado...
                </p>
              </div>
            ) : fvConfig ? (
              <>
                {/* SELETOR DE DATA RETROATIVA COM ALERTA DE COR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', padding: '1rem', 
              background: selectedDate !== getTodayKey() ? (isDark ? 'rgba(231, 76, 60, 0.15)' : 'rgba(231, 76, 60, 0.1)') : (isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)'), 
              borderRadius: '12px', 
              border: `2px solid ${selectedDate !== getTodayKey() ? '#e74c3c' : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}` 
            }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={24} color={isDark ? '#d4af37' : '#6b4423'} />
                    <span style={{ fontWeight: 'bold', color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif", fontSize: '1.2rem' }}>
                      {selectedDate === getTodayKey() ? "Hoje" : "Registro do dia"}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} max={getTodayKey()} style={{ padding: '0.6rem', borderRadius: '8px', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem', fontFamily: 'Georgia, serif', cursor: 'pointer' }} />
                    {selectedDate !== getTodayKey() && (
                      <button onClick={() => handleDateChange(getTodayKey())} style={{ padding: '0.6rem 1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Voltar</button>
                    )}
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.1) 100%)', padding: '2rem', borderRadius: '16px', border: '2px solid #FFD700', boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)' }}>
                  
                  {/* CABEÇALHO */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Award size={32} color="#FFD700" />
                      <div>
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>
                          {fvConfig.tituloAba}
                        </h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem' }}>Dia: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>

                    {/* BARRA DE ESTATÍSTICAS MENSAIS (30 DIAS) */}
                  {(() => {
                    const totals = getFvMonthlyTotals();
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', marginBottom: '2rem', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', display: 'block' }}>Total Voluntariado</span>
                          <strong style={{ fontSize: '1.2rem', color: isDark ? '#FFD700' : '#996515' }}>{totals.voluntariado}</strong>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: isMobile ? 'none' : '1px solid rgba(255,215,0,0.2)', borderTop: isMobile ? '1px solid rgba(255,215,0,0.2)' : 'none', paddingTop: isMobile ? '0.5rem' : '0' }}>
                          <span style={{ fontSize: '0.7rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', display: 'block' }}>Aulas Assistidas</span>
                          <strong style={{ fontSize: '1.2rem', color: isDark ? '#FFD700' : '#996515' }}>{totals.assistida}</strong>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: isMobile ? 'none' : '1px solid rgba(255,215,0,0.2)', borderTop: isMobile ? '1px solid rgba(255,215,0,0.2)' : 'none', paddingTop: isMobile ? '0.5rem' : '0' }}>
                          <span style={{ fontSize: '0.7rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', display: 'block' }}>Aulas Ministradas</span>
                          <strong style={{ fontSize: '1.2rem', color: isDark ? '#FFD700' : '#996515' }}>{totals.ministrada}</strong>
                        </div>
                      </div>
                    );
                  })()}

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: fvDiaryStreak > 0 ? 'rgba(74, 144, 226, 0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'), border: `1px solid ${fvDiaryStreak > 0 ? '#4A90E2' : (isDark ? '#555' : '#ccc')}`, borderRadius: '20px', color: fvDiaryStreak > 0 ? '#4A90E2' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold' }}>
                        <Mountain size={18} /> {fvDiaryStreak}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: fvTasksStreak > 0 ? 'rgba(155, 89, 182, 0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'), border: `1px solid ${fvTasksStreak > 0 ? '#9B59B6' : (isDark ? '#555' : '#ccc')}`, borderRadius: '20px', color: fvTasksStreak > 0 ? '#9B59B6' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold' }}>
                        <Landmark size={18} /> {fvTasksStreak}
                      </div>
                      <button onClick={handleInstantFvLock} style={{ padding: '0.5rem', background: 'transparent', color: '#e74c3c', border: 'none', cursor: 'pointer' }}><Lock size={22} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '1rem' }}>
                    
                    {/* REFLEXÕES DINÂMICAS */}
                    <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                      <h3 style={{ margin: '0 0 1.5rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>{fvConfig.secaoReflexao}</h3>
                      
                      {fvConfig.itensCarta.map(item => (
                        <div key={item.id} style={{ marginBottom: '1.5rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>{item.label}</label>
                          <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.75rem', fontStyle: 'italic' }}>{item.desc}</p>
                          <textarea value={fvDaily[item.id] || ''} onChange={(e) => handleFvDailyTextChange(item.id, e.target.value)} rows={3} style={{ width: '100%', padding: '1rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                        </div>
                      ))}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: isDark ? '#FFD700' : '#996515' }}>Horas Voluntariado</label>
                          <input type="time" value={fvDaily.horasVoluntariado || ''} onChange={(e) => handleFvDailyTextChange('horasVoluntariado', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: isDark ? '#FFD700' : '#996515' }}>Aula Assistida</label>
                          <input type="time" value={fvDaily.horasAulaAssistida || ''} onChange={(e) => handleFvDailyTextChange('horasAulaAssistida', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: isDark ? '#FFD700' : '#996515' }}>Aula Ministrada</label>
                          <input type="time" value={fvDaily.horasAulaMinistrada || ''} onChange={(e) => handleFvDailyTextChange('horasAulaMinistrada', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                      </div>

                      <button onClick={saveFvTexts} style={{ width: '100%', padding: '1rem', background: 'rgba(74, 144, 226, 0.2)', color: isDark ? '#6cb2eb' : '#2980b9', border: '2px solid #4A90E2', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Mountain size={20} /> Salvar Reflexões e Horas
                      </button>
                    </div>

                    {/* PRÁTICAS DINÂMICAS */}
                    <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>Práticas</h3>
                        <span style={{ fontSize: '0.8rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', padding: '0.4rem 0.8rem', borderRadius: '12px' }}>Em caso de dúvida sobre como realizar as práticas, peça orientações ao seu mestre.</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                          {fvConfig.praticas.map(prac => (
                            <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: fvDaily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'), border: `1px solid ${fvDaily.praticas?.[prac.key] ? '#4caf50' : (isDark ? 'rgba(212, 175, 55, 0.3)' : '#ccc')}`, borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                              {fvDaily.praticas?.[prac.key] ? <CheckCircle size={18} color="#4caf50" /> : <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${isDark ? '#b8a88a' : '#999'}` }}></div>}
                              <span style={{ color: fvDaily.praticas?.[prac.key] ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '0.95rem', fontWeight: fvDaily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                            </div>
                          ))}
                        </div>

                        {/* O Templo Interior (Fixo no código por conta da lógica dos Checkboxes de Templo) */}
                        <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #FFD700' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1rem' }}>Templo Interior</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            {[
                              { key: 'porta', label: '1. Porta' },
                              { key: 'patioAberto', label: '2. Pátio Aberto' },
                              { key: 'patioColunas', label: '3. Pátio de Colunas' },
                              { key: 'santuario', label: '4. Santuário' }
                            ].map(prac => (
                              <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.6rem', background: fvDaily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : 'transparent', border: `1px solid ${fvDaily.praticas?.[prac.key] ? '#4caf50' : 'transparent'}`, borderRadius: '8px', transition: 'all 0.2s' }}>
                                {fvDaily.praticas?.[prac.key] ? <CheckCircle size={16} color="#4caf50" /> : <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${isDark ? '#b8a88a' : '#999'}` }}></div>}
                                <span style={{ color: fvDaily.praticas?.[prac.key] ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#c8b896' : '#6b5744'), fontSize: '0.9rem', fontWeight: fvDaily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button onClick={saveFvPractices} style={{ width: '100%', padding: '1rem', background: 'rgba(155, 89, 182, 0.2)', color: isDark ? '#c39bd3' : '#8e44ad', border: '2px solid #9B59B6', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Landmark size={20} /> Salvar Práticas
                      </button>
                    </div>
                  </div>

                  <div style={{ height: '2px', background: 'rgba(255,215,0,0.3)', margin: '3rem 0 2rem' }}></div>

                  {/* MÓDULO GDVE DINÂMICO */}
                  <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.2)', marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Star size={24} /> {fvConfig.modulo2.titulo}
                    </h3>
                    
                    <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', padding: '1rem', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1rem' }}>{fvConfig.modulo2.rotuloLeitura}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#b8a88a' : '#6b5744' }}>Selecione o Bastião/Grupo</label>
                          <select 
                            value={fvGdveBastiaoName} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setFvGdveBastiaoName(val);
                              const found = fvConfig.modulo2.bancoTemas.find(b => b.name === val);
                              if (found) setFvGdveBastiaoLink(found.link);
                              else if (val !== 'Outro') setFvGdveBastiaoLink('');
                            }} 
                            style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}
                          >
                            <option value="">Selecione na lista...</option>
                            {fvConfig.modulo2.bancoTemas.map((b, idx) => (
                              <option key={idx} value={b.name}>{b.name}</option>
                            ))}
                            <option value="Outro">Outro (Inserir Manualmente)</option>
                          </select>
                        </div>

                        {fvGdveBastiaoName === 'Outro' && (
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#b8a88a' : '#6b5744' }}>Link do PDF (Manual)</label>
                            <input 
                              type="url" 
                              value={fvGdveBastiaoLink} 
                              onChange={(e) => setFvGdveBastiaoLink(e.target.value)} 
                              placeholder="Cole o link aqui..." 
                              style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} 
                            />
                          </div>
                        )}
                      </div>

                      {fvGdveBastiaoLink && (
                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <a href={fvGdveBastiaoLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transition: 'all 0.2s' }}>
                            <BookOpen size={18} /> Acessar Leitura
                          </a>
                        </div>
                      )}
                    </div>

                    {/* REUNIÃO */}
                    <div style={{ padding: '1rem', background: fvDaily.gdveAttendance ? (isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9') : (isDark ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0'), borderRadius: '8px', border: `1px solid ${fvDaily.gdveAttendance ? '#4caf50' : (isDark ? 'rgba(255, 152, 0, 0.3)' : '#ffb74d')}`, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: fvDaily.gdveAttendance ? '#4caf50' : (isDark ? '#ffb74d' : '#e65100'), fontSize: '1.05rem' }}>Reunião</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744' }}>Registrar participação e calcular próximo encontro.</p>
                      </div>
                      <button onClick={registerGdveAttendance} style={{ padding: '0.75rem 1.5rem', background: fvDaily.gdveAttendance ? '#4caf50' : 'transparent', color: fvDaily.gdveAttendance ? '#fff' : (isDark ? '#ffb74d' : '#e65100'), border: `2px solid ${fvDaily.gdveAttendance ? '#4caf50' : (isDark ? '#ffb74d' : '#e65100')}`, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                        {fvDaily.gdveAttendance ? <><CheckCircle size={18} /> Participação Confirmada</> : 'Marcar Participação nesta data'}
                      </button>
                    </div>

                    {/* TAREFAS GDVE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, color: isDark ? '#d4af37' : '#6b4423', fontSize: '1rem' }}>Práticas Específicas do Grupo</h4>
                    </div>
                    
                    <div style={{ padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input type="text" value={newGdveTaskName} onChange={(e) => setNewGdveTaskName(e.target.value)} placeholder="Ex: Dizer 'eu sou discípulo'..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>
                          <input type="checkbox" checked={newGdveTaskIsCycle} onChange={(e) => { setNewGdveTaskIsCycle(e.target.checked); if(e.target.checked) setNewGdveTaskTarget(1); }} style={{ width: '18px', height: '18px', accentColor: '#d4af37' }} />
                          <span>Missão de Ciclo (Não zera por dia)</span>
                        </label>
                        {!newGdveTaskIsCycle && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>
                            <span>Vezes por dia:</span>
                            <input type="number" min="1" max="100" value={newGdveTaskTarget} onChange={(e) => setNewGdveTaskTarget(e.target.value)} style={{ width: '60px', padding: '0.4rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                          </div>
                        )}
                        <button onClick={addGdveTask} style={{ marginLeft: 'auto', padding: '0.6rem 1.2rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                          {editingGdveTaskId ? 'Salvar Edição' : 'Adicionar'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {fvGdveTasks.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>Nenhuma prática cadastrada.</p>
                      ) : (
                        fvGdveTasks.map(task => {
                          const isCycle = task.isCycle;
                          const isCounter = !isCycle && task.target > 1;
                          let isCompleted = false;
                          let displayValue = '';

                          const currentCount = (typeof fvDaily.gdveTasksStatus?.[task.id] === 'boolean' ? (fvDaily.gdveTasksStatus[task.id] ? 1 : 0) : fvDaily.gdveTasksStatus?.[task.id]) || 0;
                          const targetCount = task.target || 1;
                          const taskColor = getTaskColor(currentCount, targetCount, isDark);

                          if (isCycle) {
                             isCompleted = !!fvGdveCycleStatus[task.id];
                             displayValue = isCompleted ? 'Feito' : 'Pendente';
                          } else if (isCounter) {
                             isCompleted = currentCount >= targetCount;
                             displayValue = `${currentCount}/${targetCount}`;
                          } else {
                             isCompleted = !!fvDaily.gdveTasksStatus?.[task.id];
                          }

                          return (
                            <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)', borderRadius: '8px', border: `2px solid ${taskColor}`, transition: 'all 0.3s ease' }}>
                              <div onClick={() => toggleGdveTask(task)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                {isCounter ? (
                                  <div style={{ padding: '0.4rem 0.8rem', background: taskColor, border: `1px solid ${taskColor}`, borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem', minWidth: '50px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                                    {displayValue}
                                  </div>
                                ) : (
                                  <input type="checkbox" checked={isCompleted} readOnly style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#4caf50' }} />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ color: isCompleted ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), textDecoration: isCompleted ? 'line-through' : 'none', fontWeight: isCompleted ? 'bold' : 'normal', fontSize: '1.05rem' }}>{task.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#888', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {isCycle ? '⏳ Missão de Ciclo' : (isCounter ? '📅 Meta Diária' : '📅 Diário')}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => startEditingGdveTask(task)} style={{ background: 'transparent', border: 'none', color: isDark ? '#d4af37' : '#6b4423', cursor: 'pointer', display: 'flex' }}><Edit size={18} /></button>
                                <button onClick={() => { if(window.confirm(`Excluir a tarefa "${task.name}"?`)) removeGdveTask(task.id); }} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', display: 'flex' }}><Trash2 size={18} /></button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* ACOMPANHAMENTO E DATAS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <h3 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '1.4rem', fontFamily: "'Cinzel', serif" }}>Acompanhamento Discipular</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Nome do Mestre / Instrutor</label>
                        <input type="text" value={fvMasterName || ''} onChange={(e) => setFvMasterName(e.target.value)} placeholder="Com quem você se reporta..." style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Data do Último Encontro</label>
                        <input type="date" value={fvLastMeetingDate || ''} onChange={(e) => setFvLastMeetingDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Última Entrega de Carta</label>
                        <input type="date" value={fvLastCartaDate || ''} onChange={(e) => { const novaData = e.target.value; setFvLastCartaDate(novaData); if (novaData) { const [ano, mes, dia] = novaData.split('-'); const dataCalculada = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1 + 3, parseInt(dia, 10)); setFvNextCartaDate(`${dataCalculada.getFullYear()}-${String(dataCalculada.getMonth() + 1).padStart(2, '0')}-${String(dataCalculada.getDate()).padStart(2, '0')}`); } else { setFvNextCartaDate(''); } }} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Próxima Entrega Prevista</label>
                        <input type="date" value={fvNextCartaDate || ''} onChange={(e) => setFvNextCartaDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                    </div>
                    
                    <button onClick={saveFvPlanning} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: isDark ? '#FFD700' : '#996515', border: '2px solid #FFD700', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}>
                      <Save size={18} /> Salvar Planejamento
                    </button>
                  </div>

                      {/* RELATÓRIO DISCIPULAR (IA FV) */}
                  <div style={{ background: isDark ? 'rgba(0,0,0,0.4)' : '#f0f4f8', padding: '2rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 215, 0, 0.6)'}`, marginTop: '3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '1.3rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={22} /> Relatório Discipular do Ciclo
                      </h3>
                      <button onClick={generateDiscipularSynthesis} disabled={isGeneratingDiscSync} style={{ 
                        padding: '0.6rem 1.2rem', 
                        background: isGeneratingDiscSync 
                          ? (isDark ? 'rgba(255, 152, 0, 0.15)' : '#fff3e0') 
                          : (discipularSynthesis ? (isDark ? 'rgba(39, 174, 96, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(255, 215, 0, 0.1)' : '#fff8dc')), 
                        color: isGeneratingDiscSync 
                          ? (isDark ? '#ff9800' : '#e65100') 
                          : (discipularSynthesis ? (isDark ? '#2ecc71' : '#27ae60') : (isDark ? '#FFD700' : '#996515')), 
                        border: `1px solid ${isGeneratingDiscSync 
                          ? (isDark ? '#ff9800' : '#ffb74d') 
                          : (discipularSynthesis ? (isDark ? '#2ecc71' : '#27ae60') : (isDark ? '#FFD700' : '#996515'))}`, 
                        borderRadius: '8px', 
                        cursor: isGeneratingDiscSync ? 'not-allowed' : 'pointer', 
                        fontWeight: 'bold', 
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        transition: 'all 0.3s ease'
                      }}>
                        {isGeneratingDiscSync ? <Sparkles className="animate-spin" size={16} /> : (discipularSynthesis ? <CheckCircle size={16} /> : <Target size={16} />)}
                        {isGeneratingDiscSync ? 'Forjando...' : (discipularSynthesis ? 'Relatório Gerado (Refazer)' : 'Gerar Relatório Profundo')}
                      </button>
                    </div>

                    <div style={{ background: isDark ? 'rgba(231, 76, 60, 0.15)' : '#fdf2f2', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #e74c3c', marginBottom: '1.5rem' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.5', fontStyle: 'italic' }}>
                        <strong>Aviso Ético:</strong> Este relatório utiliza Inteligência Artificial para cruzar seus hábitos e práticas FV. A máquina apenas organiza o passado; a intuição do Mestre acende o futuro. 
                        <strong style={{ color: isDark ? '#e74c3c' : '#c0392b' }}> Confiar exclusivamente neste texto é ilusão. Leve-o para o diálogo vivo com seu Instrutor.</strong>
                      </p>
                    </div>

                    {/* AS 4 CAIXAS DO RELATÓRIO DISCIPULAR COM DASHBOARD VISUAL */}
                    {discipularSynthesis ? (
                      <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* CAIXA 1: MÉTRICAS DA VONTADE (VISUAL) */}
                        {(() => {
                          const hoje = new Date();
                          const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(hoje.getDate() - 30);
                          const sessentaDiasAtras = new Date(); sessentaDiasAtras.setDate(hoje.getDate() - 60);

                          const cicloAtual = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= trintaDiasAtras && d <= hoje; });
                          const cicloAnterior = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= sessentaDiasAtras && d < trintaDiasAtras; });

                          const countPractices = (ciclo) => { let total = 0; ciclo.forEach(e => { if(e.fvDaily && e.fvDaily.praticas) { total += Object.values(e.fvDaily.praticas).filter(v => v === true).length; } }); return total; };

                          const preenchimentosAtual = cicloAtual.length;
                          const preenchimentosAnterior = cicloAnterior.length;
                          const varPreenchimentos = preenchimentosAnterior === 0 ? 100 : Math.round(((preenchimentosAtual - preenchimentosAnterior) / preenchimentosAnterior) * 100);

                          const praticasAtual = countPractices(cicloAtual);
                          const praticasAnterior = countPractices(cicloAnterior);
                          const varPraticas = praticasAnterior === 0 ? 100 : Math.round(((praticasAtual - praticasAnterior) / praticasAnterior) * 100);

                          return (
                            <div style={{ background: isDark ? 'rgba(74, 144, 226, 0.05)' : '#f4f8ff', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.3)' : 'rgba(74, 144, 226, 0.3)'}` }}>
                              <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#6cb2eb' : '#2980b9', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={18} /> Métricas da Vontade</h4>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                {/* Card 1: Preenchimentos */}
                                <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.2)' : '#ccc'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                  <span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>Dias Forjados</span>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isDark ? '#6cb2eb' : '#2980b9', fontFamily: "'Cinzel', serif" }}>{preenchimentosAtual}</span>
                                    <span style={{ fontSize: '1rem', color: isDark ? '#888' : '#999' }}>/ 30</span>
                                  </div>
                                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: varPreenchimentos >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: varPreenchimentos >= 0 ? (isDark ? '#81c784' : '#2e7d32') : '#e74c3c', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                    {varPreenchimentos >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                                    {varPreenchimentos > 0 ? '+' : ''}{varPreenchimentos}%
                                  </div>
                                </div>

                                {/* Card 2: Práticas FV */}
                                <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.2)' : '#ccc'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                  <span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>Práticas FV Realizadas</span>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isDark ? '#6cb2eb' : '#2980b9', fontFamily: "'Cinzel', serif" }}>{praticasAtual}</span>
                                    <span style={{ fontSize: '1rem', color: isDark ? '#888' : '#999' }}>ações</span>
                                  </div>
                                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: varPraticas >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: varPraticas >= 0 ? (isDark ? '#81c784' : '#2e7d32') : '#e74c3c', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                    {varPraticas >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                                    {varPraticas > 0 ? '+' : ''}{varPraticas}%
                                  </div>
                                </div>
                              </div>
                              
                              {/* Texto opcional da IA analisando a matemática */}
                              {fvAiMetricas && <p style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', lineHeight: '1.6', borderTop: `1px dashed ${isDark ? 'rgba(74, 144, 226, 0.3)' : 'rgba(74, 144, 226, 0.3)'}`, paddingTop: '1rem' }}>{fvAiMetricas}</p>}
                            </div>
                          );
                        })()}

                        {/* CAIXA 2: AUDITORIA ESTOICA CRUZADA */}
                        <div style={{ background: isDark ? 'rgba(255, 152, 0, 0.05)' : '#fff8f0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 152, 0, 0.3)'}` }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: isDark ? '#ffb74d' : '#e65100', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={18} /> Auditoria Cruzada</h4>
                          <p style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem', lineHeight: '1.6' }}>{fvAiAuditoria}</p>
                        </div>

                        {/* CAIXA 3: VARREDURA LEXICAL */}
                        <div style={{ background: isDark ? 'rgba(155, 89, 182, 0.05)' : '#fdf8ff', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.3)' : 'rgba(155, 89, 182, 0.3)'}` }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: isDark ? '#c39bd3' : '#8e44ad', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Eye size={18} /> Varredura Lexical (Itens FV)</h4>
                          <p style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem', lineHeight: '1.6' }}>{fvAiLexical}</p>
                        </div>

                        {/* CAIXA 4: SÍNTESE GERAL */}
                        <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.4)' : '#FFD700'}`, whiteSpace: 'pre-wrap', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', lineHeight: '1.7', fontFamily: 'Georgia, serif' }}>
                          <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>Conclusão e Pauta do Ciclo</h4>
                          {discipularSynthesis}
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic', textAlign: 'center', margin: '2rem 0' }}>Sua Alma aguarda a síntese das suas batalhas. Clique no botão acima para processar o ciclo.</p>
                    )}

                    {/* BLOCO DE AVALIAÇÃO DA SÍNTESE FV */}
                    {discipularSynthesis && (
                      <div style={{ marginTop: '2rem', padding: '1.5rem', background: isDark ? 'rgba(0,0,0,0.3)' : '#fdfbf7', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(255, 215, 0, 0.4)' : 'rgba(153, 101, 21, 0.3)'}`, textAlign: 'center' }}>
                        {feedbackSubmitted ? (
                          <p style={{ color: isDark ? '#FFD700' : '#996515', fontWeight: 'bold', margin: 0 }}>✓ Avaliação enviada anonimamente. Obrigado por ajudar a calibrar o sistema!</p>
                        ) : (
                          <>
                            <p style={{ margin: '0 0 1rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', fontWeight: 'bold' }}>Este relatório técnico foi útil e preciso?</p>
                            
                            {/* Estrelas */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button 
                                  key={star} 
                                  onClick={() => setFeedbackRating(star)} 
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                  <Star size={28} fill={feedbackRating >= star ? (isDark ? '#FFD700' : '#FFB300') : 'none'} color={feedbackRating >= star ? (isDark ? '#FFD700' : '#FFB300') : (isDark ? '#555' : '#ccc')} />
                                </button>
                              ))}
                            </div>

                            {/* Campo de Texto (Só aparece se ele der uma nota) */}
                            {feedbackRating > 0 && (
                              <div className="animate-fadeIn">
                                <textarea 
                                  value={feedbackText} 
                                  onChange={(e) => setFeedbackText(e.target.value)} 
                                  placeholder="Opcional: Por que você deu esta nota? A análise de dados ajudou?" 
                                  rows={3} 
                                  style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', marginBottom: '1rem' }} 
                                />
                                <button 
                                  onClick={() => submitSynthesisFeedback("FV")} 
                                  style={{ padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 4px 10px rgba(255,215,0,0.2)' }}
                                >
                                  Enviar Avaliação Anônima
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', borderRadius: '16px', border: `2px solid #e74c3c` }}>
                <AlertCircle size={48} color="#e74c3c" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: '#e74c3c', fontSize: '1.1rem' }}>Erro de Conexão com o Firebase. Dê os 7 cliques novamente para inicializar.</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW: HISTORY */}
        {view === 'history' && (
          <div className="animate-fadeIn">
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.5rem', color: isDark ? '#d4af37' : '#6b4423', margin: 0 }}>Histórico de Reflexões</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={exportToCSV} disabled={entries.length === 0} style={{ padding: '0.75rem 1.5rem', background: entries.length > 0 ? (isDark ? '#d4af37' : '#6b4423') : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: entries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={18} /> Exportar CSV
                </button>
                {/* NOVO: BOTÃO DO RELATÓRIO TXT FV */}
                {fvUnlocked && (
                  <button onClick={exportFvReportTXT} disabled={entries.length === 0} style={{ padding: '0.75rem 1.5rem', background: entries.length > 0 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : '#ccc', color: '#000', border: 'none', borderRadius: '8px', cursor: entries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: entries.length > 0 ? '0 4px 12px rgba(255,215,0,0.2)' : 'none' }}>
                    <FileText size={18} /> Relatório CD (TXT)
                  </button>
                )}
                <label style={{ padding: '0.75rem 1.5rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={18} /> Importar
                  <input type="file" accept=".csv,.json,.txt" onChange={importDiary} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* PAINEL DATAS FV NO HISTÓRICO */}
            {fvUnlocked && (fvLastCartaDate || fvGdveReuniao) && (
              <div className="animate-fadeIn" style={{ background: isDark ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, rgba(255, 165, 0, 0.05) 100%)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.3)' : '#ffe082'}`, marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#ffd700' : '#d4af37', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}><Award size={20} /> Planejamento FV</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {fvLastCartaDate && (<div><span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block' }}>Última Carta:</span><strong style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>{new Date(fvLastCartaDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>)}
                  {fvNextCartaDate && (<div><span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block' }}>Próxima Entrega:</span><strong style={{ color: '#e74c3c' }}>{new Date(fvNextCartaDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>)}
                  {fvGdveReuniao && (<div><span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block' }}>Próx. Reunião GDVE:</span><strong style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>{new Date(fvGdveReuniao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></div>)}
                </div>
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <Search size={20} color={isDark ? '#d4af37' : '#6b4423'} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Buscar nas reflexões..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 3rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
            </div>

            {filteredEntries.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                <Calendar size={48} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem' }}>{searchTerm ? 'Nenhuma entrada encontrada' : 'Nenhuma reflexão registrada ainda'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(() => {
                  // Variáveis para saber o que abrir por padrão
                  const todayObj = new Date();
                  const currentYearStr = todayObj.getFullYear().toString();
                  const currentMonthStr = todayObj.toLocaleDateString('pt-BR', { month: 'long' });
                  const currentMonthKey = `${currentMonthStr.charAt(0).toUpperCase() + currentMonthStr.slice(1)} ${currentYearStr}`;

                  // 1. Agrupa as entradas por Ano -> Mês preservando a ordem cronológica
                  const groupedEntries = [];
                  filteredEntries.forEach(entry => {
                    const dateObj = new Date(entry.date + 'T12:00:00');
                    const year = dateObj.getFullYear().toString();
                    const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
                    const month = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
                    const monthKey = `${month} ${year}`;
                    
                    let yearGroup = groupedEntries.find(g => g.year === year);
                    if (!yearGroup) {
                        yearGroup = { year, total: 0, months: [] };
                        groupedEntries.push(yearGroup);
                    }
                    yearGroup.total++;
                    
                    let monthGroup = yearGroup.months.find(m => m.monthKey === monthKey);
                    if (!monthGroup) {
                        monthGroup = { month, monthKey, entries: [] };
                        yearGroup.months.push(monthGroup);
                    }
                    monthGroup.entries.push(entry);
                  });

                  // 2. Renderiza Anos > Meses > Entradas
                  return groupedEntries.map((yearGroup) => {
                    // Lógica Mágica: O ano atual fica aberto por padrão. Os antigos fechados.
                    const isYearExpanded = expandedYears[yearGroup.year] !== undefined ? expandedYears[yearGroup.year] : (yearGroup.year === currentYearStr);

                    return (
                      <div key={yearGroup.year} style={{ background: isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(240, 230, 210, 0.4)', borderRadius: '16px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, overflow: 'hidden' }}>
                        
                        {/* CABEÇALHO DO ANO */}
                        <div 
                          onClick={() => setExpandedYears(prev => ({ ...prev, [yearGroup.year]: !isYearExpanded }))}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(139, 115, 85, 0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <h2 style={{ margin: 0, color: isDark ? '#FFD700' : '#6b4423', fontFamily: "'Cinzel', serif", fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Calendar size={24} /> {yearGroup.year}
                            <span style={{ fontSize: '0.9rem', opacity: 0.8, background: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontFamily: 'Georgia, serif' }}>
                              {yearGroup.total} {yearGroup.total === 1 ? 'dia' : 'dias'}
                            </span>
                          </h2>
                          {isYearExpanded ? <ChevronUp size={28} color={isDark ? '#FFD700' : '#6b4423'} /> : <ChevronDown size={28} color={isDark ? '#FFD700' : '#6b4423'} />}
                        </div>

                        {/* LISTA DE MESES DENTRO DO ANO */}
                        {isYearExpanded && (
                          <div className="animate-fadeIn" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {yearGroup.months.map((monthGroup) => {
                              // Lógica Mágica: O mês corrente fica aberto por padrão. Os outros fechados.
                              const isMonthExpanded = expandedMonths[monthGroup.monthKey] !== undefined ? expandedMonths[monthGroup.monthKey] : (monthGroup.monthKey === currentMonthKey);

                              return (
                                <div key={monthGroup.monthKey} style={{ marginBottom: '0.5rem' }}>
                                  
                                  {/* CABEÇALHO DO MÊS */}
                                  <div 
                                    onClick={() => setExpandedMonths(prev => ({ ...prev, [monthGroup.monthKey]: !isMonthExpanded }))}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'white', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, transition: 'all 0.2s' }}
                                  >
                                    <h3 style={{ margin: 0, color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif", fontSize: '1.3rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <BookOpen size={18} /> {monthGroup.month}
                                      <span style={{ fontSize: '0.85rem', opacity: 0.8, background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(139,115,85,0.1)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontFamily: 'Georgia, serif' }}>
                                        {monthGroup.entries.length} {monthGroup.entries.length === 1 ? 'dia' : 'dias'}
                                      </span>
                                    </h3>
                                    {isMonthExpanded ? <ChevronUp size={20} color={isDark ? '#d4af37' : '#6b4423'} /> : <ChevronDown size={20} color={isDark ? '#d4af37' : '#6b4423'} />}
                                  </div>

                                  {/* DIAS DENTRO DO MÊS */}
                                  {isMonthExpanded && (
                                    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', paddingLeft: '0.5rem', borderLeft: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                                      {monthGroup.entries.map((entry) => {
                                        const isExpanded = expandedEntryId === entry.id;
                                        const isPartial = entry.morningDone && !entry.eveningDone;

                                        return (
                                          <div key={entry.id} style={{ background: isPartial ? (isDark ? 'rgba(40, 25, 10, 0.6)' : '#fffdf5') : (isDark ? 'rgba(26, 26, 46, 0.6)' : 'white'), padding: '1.5rem', borderRadius: '12px', border: `2px solid ${isPartial ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
                                            
                                            {/* CABEÇALHO RESUMIDO E CLICÁVEL */}
                                            <div onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                              <div>
                                                <h3 style={{ margin: 0, color: isPartial ? (isDark ? '#ffb74d' : '#e65100') : (isDark ? '#d4af37' : '#6b4423'), fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                                  {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </h3>
                                                
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                  {entry.virtue && <span style={{ padding: '0.2rem 0.6rem', background: isDark ? 'rgba(212,175,55,0.2)' : '#fdf5e6', borderRadius: '4px', fontSize: '0.85rem', color: isDark ? '#d4af37' : '#6b4423', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : '#e8dcc4'}` }}>Virtude: <strong>{entry.virtue}</strong></span>}

                                                  {!entry.didMorning && <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,152,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)' }}>⚠️ Sem Prólogo</span>}
  
                                                  {isPartial && <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,152,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)' }}>⏳ Epílogo Pendente</span>}
  
                                                  {entry.fvDaily && fvUnlocked && (
                                                    <span style={{ padding: '0.2rem 0.6rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', borderRadius: '4px', fontSize: '0.85rem', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 4px rgba(255,215,0,0.2)' }}>
                                                      <Award size={12} /> FV
                                                    </span>
                                                  )}

                                                  {/* NOVO SELO GDVE NO HISTÓRICO */}
                                                  {entry.fvDaily && entry.fvDaily.gdveAttendance && fvUnlocked && (
                                                    <span style={{ padding: '0.2rem 0.6rem', background: 'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)', borderRadius: '4px', fontSize: '0.85rem', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 4px rgba(155,89,182,0.3)' }}>
                                                      <Star size={12} /> GDVE
                                                    </span>
                                                  )}
                                                </div>

                                              </div>
                                              
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <button onClick={(e) => { e.stopPropagation(); handleDateChange(entry.date); setView('today'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '0.5rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer' }} title="Preencher ou Editar este dia"><Edit size={16} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); deleteEntry(entry.date); }} style={{ padding: '0.5rem', background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', borderRadius: '8px', cursor: 'pointer' }} title="Excluir"><X size={16} /></button>
                                                {isExpanded ? <ChevronUp size={24} color={isDark ? '#d4af37' : '#6b4423'} /> : <ChevronDown size={24} color={isDark ? '#d4af37' : '#6b4423'} />}
                                              </div>
                                            </div>

                                            {/* CONTEÚDO EXPANDIDO */}
                                            {isExpanded && (
                                              <div className="animate-fadeIn" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                                                
                                                {entry.intention && (
                                                  <div style={{ marginBottom: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>Compromisso:</h4>
                                                    <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.intention}</p>
                                                  </div>
                                                )}

                                                {entry.tasksSnapshot && entry.tasksSnapshot.length > 0 && (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                                    {entry.tasksSnapshot.filter(t => t.completed).length > 0 && (
                                                      <div style={{ padding: '1rem', background: isDark ? 'rgba(76, 175, 80, 0.05)' : '#f8fff8', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#4caf50' : '#81c784'}` }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#81c784' : '#2e7d32', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> Práticas Realizadas:</h4>
                                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#c8b896' : '#2e7d32', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                                          {entry.tasksSnapshot.filter(t => t.completed).map((task, idx) => <li key={idx}>{task.name}</li>)}
                                                        </ul>
                                                      </div>
                                                    )}
                                                    {entry.tasksSnapshot.filter(t => !t.completed).length > 0 && (
                                                      <div style={{ padding: '1rem', background: isDark ? 'rgba(244, 67, 54, 0.05)' : '#fff5f5', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#f44336' : '#e53935'}` }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#e57373' : '#c62828', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><XCircle size={16} /> Práticas Não Realizadas:</h4>
                                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#b8a88a' : '#c62828', fontSize: '0.95rem', lineHeight: '1.6', textDecoration: 'line-through', opacity: 0.8 }}>
                                                          {entry.tasksSnapshot.filter(t => !t.completed).map((task, idx) => <li key={idx}>{task.name}</li>)}
                                                        </ul>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}

                                                {entry.fvDaily && entry.fvDaily.praticas && (fvUnlocked || entry.fvDaily.praticas.tratack) && (
                                                  <div style={{ padding: '1rem', background: isDark ? 'rgba(255, 215, 0, 0.05)' : '#fffbf0', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#FFD700' : '#996515'}`, marginBottom: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                      <Award size={16} /> {fvUnlocked ? 'Práticas FV Realizadas:' : 'Práticas Extras Realizadas:'}
                                                    </h4>
                                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#c8b896' : '#6b5744', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                                      {(() => {
                                                        const praticasFeitas = Object.entries(entry.fvDaily.praticas).filter(([_, feito]) => feito).map(([key]) => key);
                                                        const listaPermitida = fvUnlocked ? praticasFeitas : praticasFeitas.filter(k => k === 'tratack');

                                                        if (listaPermitida.length === 0) return fvUnlocked ? <li style={{ fontStyle: 'italic', opacity: 0.7, listStyle: 'none', marginLeft: '-1.2rem' }}>Apenas os registros escritos foram salvos.</li> : null;

                                                        const dicionarioGeral = { tratack: 'Tratak', recitarHonra: 'Recitar Código de Dignidade', recitar7Fases: 'Recitar 7 Fases da ED', camara: 'Câmara de Purificação' };
                                                        const dicionarioTemplo = { porta: 'Porta', patioAberto: 'Pátio Aberto', patioColunas: 'Pátio de Colunas', santuario: 'Santuário' };
                                                        const listaGeral = listaPermitida.filter(key => dicionarioGeral[key]);
                                                        const listaTemplo = ['porta', 'patioAberto', 'patioColunas', 'santuario'].filter(key => listaPermitida.includes(key));

                                                        return (
                                                          <>
                                                            {listaGeral.map(key => <li key={key}><strong>{dicionarioGeral[key]}</strong></li>)}
                                                            {listaTemplo.length > 0 && (<li key="templo-grupo"><strong>Templo: {listaTemplo.map(k => dicionarioTemplo[k]).join(', ')}</strong></li>)}
                                                          </>
                                                        );
                                                      })()}
                                                    </ul>
                                                  </div>
                                                )}   

                                                {entry.eveningDone && (
                                                  <>
                                                    {entry.whereIFailed && (
                                                      <div style={{ marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>Em que falhei:</h4>
                                                        <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.whereIFailed}</p>
                                                      </div>
                                                    )}
                                                    {entry.whatIDidWell && (
                                                      <div style={{ marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>O que fiz bem:</h4>
                                                        <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.whatIDidWell}</p>
                                                      </div>
                                                    )}
                                                    {entry.whatILeftUndone && (
                                                      <div style={{ marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>O que deixei de fazer:</h4>
                                                        <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.whatILeftUndone}</p>
                                                      </div>
                                                    )}
                                                    {entry.freeEpilogue && (
                                                      <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px dashed ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>Reflexão Livre:</h4>
                                                        <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{entry.freeEpilogue}</p>
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

      {/* MODAL DO FOGO INTERNO (MEDIDA IDEAL + MOTIVACIONAL) */}
        {showStreakModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setShowStreakModal(false)}>
            <div style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '1.5rem', borderRadius: '16px', maxWidth: '380px', width: '100%', border: `2px solid ${isDark ? '#ff9800' : '#e65100'}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowStreakModal(false)} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={20} /></button>
              
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <StreakIcon size={46} fill={isDark ? '#ff9800' : '#e65100'} color={isDark ? '#ff9800' : '#e65100'} style={{ margin: '0 auto 0.5rem' }} />
                <h2 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.5rem' }}>Fogo Interno</h2>
              </div>

              {/* CAIXA DO GRAU E PROGRESSO */}
              <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff', padding: '1.2rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.3)' : '#ffb74d'}`, textAlign: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', color: isDark ? '#ffb74d' : '#e65100', display: 'block', marginBottom: '0.2rem' }}>Grau Atual</span>
                <h3 style={{ margin: '0 0 0.25rem', fontFamily: "'Cinzel', serif", fontSize: '1.4rem', color: isDark ? '#f0e6d2' : '#2c1810' }}>{streakInfo.current.title}</h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>"{streakInfo.current.desc}"</p>
                
                {streakInfo.next ? (
                  <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.2)' : 'rgba(230, 81, 0, 0.1)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                      <span>Rumo a: {streakInfo.next.title}</span>
                      <span>Faltam {streakInfo.next.min - streak} dias</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: isDark ? 'rgba(255,255,255,0.1)' : '#eee', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                      <div style={{ width: `${Math.min(100, (streak / streakInfo.next.min) * 100)}%`, height: '100%', background: isDark ? '#ff9800' : '#e65100', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: isDark ? '#ffb74d' : '#e65100' }}>🔥 Perseverança e Constância! Preencha todos os dias para forjar seu caráter.</p>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.2)' : 'rgba(230, 81, 0, 0.1)'}` }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#ffb74d' : '#e65100', fontWeight: 'bold' }}>🌟 Você atingiu o mais alto grau de maestria e constância!</p>
                  </div>
                )}
              </div>

              {/* GRID COMPACTO DE 3 COLUNAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div style={{ background: isDark ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0', padding: '0.75rem 0.5rem', borderRadius: '10px', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.3)' : 'rgba(230, 81, 0, 0.2)'}` }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: isDark ? '#ffb74d' : '#e65100' }}>{streak}</div>
                  <div style={{ fontSize: '0.65rem', color: isDark ? '#c8b896' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold' }}>Atual</div>
                </div>
                <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.6)', padding: '0.75rem 0.5rem', borderRadius: '10px', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: isDark ? '#d4af37' : '#6b4423' }}>{longestStreak}</div>
                  <div style={{ fontSize: '0.65rem', color: isDark ? '#c8b896' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold' }}>Recorde</div>
                </div>
                <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.5)' : 'white', padding: '0.75rem 0.5rem', borderRadius: '10px', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: isDark ? '#d4af37' : '#6b4423' }}>{entries.length}</div>
                  <div style={{ fontSize: '0.65rem', color: isDark ? '#c8b896' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold' }}>Total</div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* MODAL DE SEGURANÇA */}
        {showInactivityWarning && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2.5rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid #e74c3c`, textAlign: 'center', boxShadow: '0 10px 40px rgba(231, 76, 60, 0.4)' }}>
              <AlertCircle size={56} color="#e74c3c" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.5rem' }}>Você ainda está aí?</h2>
              <p style={{ margin: '0 0 1rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem', lineHeight: '1.6' }}>Para sua segurança, o diário será fechado em <strong style={{ color: '#e74c3c', fontSize: '1.3rem' }}>{logoutCountdown}</strong> segundos.</p>
              <p className="animate-fadeIn" style={{ margin: '0 0 1.5rem 0', color: isDark ? '#81c784' : '#2e7d32', fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> Fique tranquilo, seu progresso foi salvo automaticamente.</p>
              <button onClick={keepAlive} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Continuar conectado</button>
            </div>
          </div>
        )}

{/* MODAL: CONVITE ATIVO DE NOTIFICAÇÃO */}
        {showNotificationPrompt && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2.5rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
              <button onClick={() => setShowNotificationPrompt(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={24} /></button>
              
              <Bell size={56} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.5rem' }}>Mantenha a Chama Acesa!</h2>
              <p style={{ margin: '0 0 1.5rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.05rem', lineHeight: '1.6' }}>
                Ative os lembretes para não esquecer de fazer o seu Diário Filosófico e o Exame Noturno.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button onClick={() => { toggleNotifications(); setShowNotificationPrompt(false); }} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <CheckCircle size={20} /> Ativar Lembretes
                </button>
                <button onClick={() => setShowNotificationPrompt(false)} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#b8a88a' : '#6b4423', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(107, 68, 35, 0.3)'}`, borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                  Agora não
                </button>
              </div>
            </div>
          </div>
        )}

{/* MODAL DE SUGESTÕES */}
        {showSuggestionModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
              <button onClick={() => setShowSuggestionModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={24} /></button>
              
              <MessageSquare size={48} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.6rem' }}>Caixa de Ideias</h2>
              <p style={{ margin: '0 0 1.5rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1rem', lineHeight: '1.5' }}>Encontrou um erro ou tem uma sugestão para melhorar nossa ferramenta? Nos avise!</p>
              
              <textarea 
                value={suggestionText} 
                onChange={(e) => setSuggestionText(e.target.value)} 
                placeholder="Descreva sua ideia, sugestão ou relato de erro..." 
                rows={5} 
                style={{ width: '100%', padding: '1rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', marginBottom: '1.5rem' }} 
              />
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={handleSendWhatsApp} style={{ flex: 1, padding: '0.8rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)' }}>
                  WhatsApp
                </button>
                <button onClick={handleSendEmail} style={{ flex: 1, padding: '0.8rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  E-mail
                </button>
                {/* BOTÃO DE CONFIGURAÇÕES (ENGRENAGEM) */}
              <button onClick={() => setShowSettingsModal(true)} style={{ padding: '0.5rem', background: 'transparent', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }} title="Configurações">
                <Settings size={20} color={isDark ? '#d4af37' : '#6b4423'} />
              </button>
              </div>
            </div>
          </div>
        )}

        {/* ESPAÇO GLOBAL PARA ANÚNCIO DO GOOGLE (COMPACTO) */}
        <div style={{ padding: '8px', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(107, 68, 35, 0.05)', borderRadius: '8px', marginTop: '2rem', border: `1px dashed ${isDark ? '#d4af37' : '#6b4423'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '0.65rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Publicidade</span>
          
          <div style={{ width: '100%', maxWidth: '728px' }}>
            <AdBanner slotId="9558175523" />
          </div>
        </div>

{/* MODAL DE AÇÃO DAS PRÁTICAS (REALIZAR OU JÁ REALIZADO) */}
        {activeActionMenu && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setActiveActionMenu(null)}>
            <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '350px', width: '100%', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setActiveActionMenu(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={24} /></button>
              
              <h3 style={{ margin: '0 0 1.5rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '1.3rem' }}>{activeActionMenu.label}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button onClick={() => handleRealizarPratica(activeActionMenu.key)} style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(255,215,0,0.2)' }}>
                  <Zap size={20} /> Realizar no App
                </button>
                
                <button onClick={() => { handleFvDailyPracticeChange(activeActionMenu.key, true); setActiveActionMenu(null); }} style={{ width: '100%', padding: '1rem', background: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9', color: isDark ? '#81c784' : '#2e7d32', border: `2px solid ${isDark ? '#4caf50' : '#4caf50'}`, borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} /> Já Realizado
                </button>

                {/* Se já estiver marcado, dá a opção de desmarcar */}
                {fvDaily.praticas?.[activeActionMenu.key] && (
                  <button onClick={() => { handleFvDailyPracticeChange(activeActionMenu.key, false); setActiveActionMenu(null); }} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: isDark ? '#b8a88a' : '#6b5744', border: 'none', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}>
                    Desmarcar prática
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL IMERSIVO UNIVERSAL: PRÁTICAS GUIADAS */}
        {isPracticeActive && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? '#0a0a14' : '#fdfbf7', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            
            {/* --- 1. PRÁTICA: TRATAK --- */}
            {activePracticeId === 'tratack' && (
              <>
                {/* FASE 1: INSTRUÇÃO */}
                {practicePhase === 'intro' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '500px' }}>
                    <Target size={48} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1.5rem' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', margin: '0 0 1rem 0' }}>
                      <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '2rem', margin: 0 }}>Prática de Tratak</h2>
                      <button onClick={() => alert("O Tratak é um exercício milenar de concentração. Consiste em manter o olhar fixamente cravado em um único ponto (o círculo central) sem piscar e sem mover o corpo ou o celular.\n\nObjetivo: Domar a mente agitada através do controle absoluto do corpo. Se o celular tremer ou você mover o mouse, a prática é cancelada.")} style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'transparent', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, color: isDark ? '#FFD700' : '#996515', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="O que é o Tratak?">?</button>
                    </div>
                    
                    <div style={{ background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(153,101,21,0.05)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', margin: 0 }}>Posicione o seu dispositivo a cerca de 1 metro de distância, alinhado à altura dos olhos.</p>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', marginTop: '1rem', marginBottom: 0 }}>Sente-se adequadamente, com a coluna ereta. Respire fundo e clique em iniciar.</p>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.5rem', fontStyle: 'italic' }}>A prática durará 3 minutos. Mantenha o olhar fixo no ponto central.</p>
                    
                    {/* NOVO: Aviso de Encerramento */}
                    <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '2rem', fontWeight: 'bold' }}>⚠️ Para encerrar antecipadamente, mova o mouse.</p>

                    <button 
                      onClick={() => { 
                        setPracticePhase('practice'); 
                        setCancelClickCount(0); // Zera os cliques ao começar!
                        enterFullScreen(); // 👈 LIGA A TELA CHEIA AQUI
                      }} 
                      style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                    >
                      Iniciar Tratak
                    </button>
                    <button onClick={() => setIsPracticeActive(false)} style={{ marginTop: '1rem', display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#888' : '#6b5744', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>Voltar ao Diário</button>
                  </div>
                )}

                {/* FASE 2: O CÍRCULO (CANCELA AO MOVER O MOUSE) */}
                {practicePhase === 'practice' && (
                  <div 
                    className="animate-fadeIn" 
                    onMouseMove={() => {
                      if (tratakMouseActive) {
                        alert("Prática interrompida.\n\nComo o tempo estipulado não foi atingido, esta sessão não será adicionada ao seu registro de práticas realizadas.");
                        setIsPracticeActive(false); 
                        exitFullScreen(); 
                        setTratakMouseActive(false);
                      }
                    }}
                    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', cursor: 'none' }}
                  >
                    <div style={{ width: 'min(85vw, 500px)', aspectRatio: '1/1', borderRadius: '50%', border: `8px solid ${isDark ? '#fff' : '#000'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 'min(6vw, 36px)', aspectRatio: '1/1', borderRadius: '50%', background: isDark ? '#fff' : '#000' }}></div>
                    </div>
                  </div>
                )}

                {/* FASE 3: CONCLUSÃO */}
                {practicePhase === 'done' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem' }}>
                    <CheckCircle size={80} color="#4caf50" style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '2.5rem', marginBottom: '1rem' }}>Tratak Realizado</h2>
                    <p style={{ fontSize: '1.2rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2.5rem' }}>O foco e a disciplina foram forjados mais um pouco hoje.</p>
                    <button 
                      onClick={() => confirmImmersivePractice('tratack')} 
                      style={{ padding: '1rem 3rem', fontSize: '1.2rem', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                    >
                      Confirmar Prática
                    </button>
                  </div>
                )}
              </>
            )}


            {/* O TOCA-DISCOS INTELIGENTE (Troca a música sozinho) */}
            <audio 
              ref={audioRef} 
              src={activePracticeId === 'templo' ? "/beethoven.mp3" : "/aria-bach.mp3"} 
              onEnded={() => setPracticePhase('done')}
            />

            {/* --- 2. PRÁTICA: CÂMARA DE PURIFICAÇÃO --- */}
            {activePracticeId === 'camara' && (
              <>
                {/* FASE 1: INSTRUÇÃO */}
                {practicePhase === 'intro' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '500px' }}>
                    <Music size={48} color={isDark ? '#81c784' : '#2e7d32'} style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#81c784' : '#2e7d32', fontSize: '2rem', margin: '0 0 1rem 0' }}>Câmara de Purificação</h2>
                    
                    <div style={{ background: isDark ? 'rgba(76, 175, 80, 0.05)' : 'rgba(76, 175, 80, 0.1)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.3)'}`, marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', margin: 0 }}>Sente-se de forma confortável, feche os olhos e respire profundamente.</p>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', marginTop: '1rem', marginBottom: 0 }}>Ao iniciar, a Ária de Bach começará a tocar. Deixe a música lavar seus pensamentos.</p>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.5rem', fontStyle: 'italic' }}>A prática terminará automaticamente ao fim da melodia (~5 min).</p>
                                        
                    <button 
                      onClick={() => { 
                        setPracticePhase('practice'); 
                        setCancelClickCount(0); 
                        enterFullScreen();
                        if(audioRef.current) audioRef.current.play(); // 👈 DÁ O PLAY NA MÚSICA AQUI!
                      }} 
                      style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', background: 'linear-gradient(135deg, #81c784 0%, #4caf50 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)' }}
                    >
                      Iniciar Purificação
                    </button>
                    <button onClick={() => setIsPracticeActive(false)} style={{ marginTop: '1rem', display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#888' : '#6b5744', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>Voltar ao Diário</button>
                  </div>
                )}

                {/* FASE 2: A PRÁTICA (TELA ESCURA MINIMALISTA) */}
                {practicePhase === 'practice' && (
                  <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', position: 'relative' }}>
                    <Music size={56} color={isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'} style={{ opacity: 0.5 }} />
                    <p style={{ marginTop: '2rem', color: isDark ? 'rgba(240, 230, 210, 0.3)' : 'rgba(44, 24, 16, 0.3)', fontStyle: 'italic', fontFamily: 'Georgia, serif', letterSpacing: '2px' }}>Respire e ouça...</p>
                    
                    {tempoDecorrido >= 180 && (
                      <button onClick={(e) => {
                        e.stopPropagation();
                        if(audioRef.current) { audioRef.current.pause(); }
                        setPracticePhase('done');
                      }} style={{ marginTop: '2rem', padding: '0.8rem 2rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(76,175,80,0.3)', animation: 'fadeIn 1s' }}>
                        <CheckCircle size={20} /> Finalizar Purificação
                      </button>
                    )}

                    {/* BOTÃO DE ENCERRAR */}
                    <button onClick={(e) => {
                      e.stopPropagation();
                      if(audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
                      setIsPracticeActive(false); 
                      exitFullScreen();
                    }} style={{ position: 'absolute', bottom: '10%', padding: '1rem 2rem', background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <XCircle size={20} /> Encerrar Prática
                    </button>
                  </div>
                )}

                {/* FASE 3: CONCLUSÃO */}
                {practicePhase === 'done' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem' }}>
                    <CheckCircle size={80} color="#4caf50" style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '2.5rem', marginBottom: '1rem' }}>Purificação Concluída</h2>
                    <p style={{ fontSize: '1.2rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2.5rem' }}>Sua mente agora está serena e limpa como um espelho d'água.</p>
                    <button 
                      onClick={() => confirmImmersivePractice('camara')} 
                      style={{ padding: '1rem 3rem', fontSize: '1.2rem', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                    >
                      Confirmar Prática
                    </button>
                  </div>
                )}
              </>
            )}

            {/* --- 3. PRÁTICA: TEMPLO INTERIOR --- */}
            {activePracticeId === 'templo' && (
              <>
                {/* FASE 1: INSTRUÇÃO */}
                {practicePhase === 'intro' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '500px' }}>
                    <Sparkles size={48} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '2rem', margin: '0 0 1rem 0' }}>Templo Interior</h2>
                    
                    <div style={{ background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(153,101,21,0.05)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', margin: 0 }}>Feche os olhos e inicie sua jornada para dentro de si.</p>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', marginTop: '1rem', marginBottom: 0 }}>Ao som de Beethoven, avance o quanto puder pelas etapas do Templo.</p>
                    </div>

                    {/* DESTAQUE PARA O TEMPO DE DURAÇÃO */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '1rem', color: isDark ? '#FFD700' : '#996515', margin: '0 0 0.25rem 0', fontWeight: 'bold' }}>⏱️ Duração: ~8 minutos e 30 segundos.</p>
                      <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', margin: 0, fontStyle: 'italic' }}>Ao final da sinfonia, você registrará seu progresso.</p>
                    </div>
              
                    <button 
                      onClick={() => { 
                        setPracticePhase('practice'); 
                        setCancelClickCount(0); 
                        enterFullScreen();
                        if(audioRef.current) { audioRef.current.load(); audioRef.current.play(); } 
                      }} 
                      style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)' }}
                    >
                      Adentrar o Templo
                    </button>
                    <button onClick={() => setIsPracticeActive(false)} style={{ marginTop: '1rem', display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#888' : '#6b5744', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>Voltar ao Diário</button>
                  </div>
                )}

                {/* FASE 2: A JORNADA (TELA ESCURA MINIMALISTA) */}
                {practicePhase === 'practice' && (
                  <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', position: 'relative' }}>
                    <Sparkles size={56} color={isDark ? 'rgba(255, 215, 0, 0.2)' : 'rgba(153, 101, 21, 0.2)'} style={{ opacity: 0.7 }} />
                    <p style={{ marginTop: '2rem', color: isDark ? 'rgba(255, 215, 0, 0.4)' : 'rgba(153, 101, 21, 0.4)', fontStyle: 'italic', fontFamily: 'Georgia, serif', letterSpacing: '2px' }}>Caminhando pelo Templo...</p>


                    {/* BOTÃO DE ENCERRAR */}
                    <button onClick={(e) => {
                      e.stopPropagation();
                      if(audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
                      setIsPracticeActive(false); 
                      exitFullScreen();
                    }} style={{ position: 'absolute', bottom: '10%', padding: '1rem 2rem', background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <XCircle size={20} /> Encerrar Prática
                    </button>
                  </div>
                )}

                {/* FASE 3: MARCAÇÃO DOS DEGRAUS (CONCLUSÃO) */}
                {practicePhase === 'done' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '400px', width: '100%' }}>
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '2rem', marginBottom: '0.5rem' }}>Jornada Concluída</h2>
                    <p style={{ fontSize: '1.1rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem' }}>Até qual etapa você conseguiu se manter consciente hoje?</p>
                    
                    {/* AS CAIXINHAS DE SELEÇÃO DO TEMPLO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', textAlign: 'left', background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(153,101,21,0.05)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}` }}>
                      {[
                        { key: 'porta', label: '1. Porta' },
                        { key: 'patioAberto', label: '2. Pátio Aberto' },
                        { key: 'patioColunas', label: '3. Pátio de Colunas' },
                        { key: 'santuario', label: '4. Santuário' }
                      ].map(prac => (
                        <label key={prac.key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', padding: '0.5rem' }}>
                          <input 
                            type="checkbox" 
                            checked={temploSelections[prac.key]} 
                            onChange={(e) => setTemploSelections(prev => ({ ...prev, [prac.key]: e.target.checked }))} 
                            style={{ width: '24px', height: '24px', cursor: 'pointer', accentColor: isDark ? '#FFD700' : '#996515' }} 
                          />
                          <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>{prac.label}</span>
                        </label>
                      ))}
                    </div>

                    <button 
                      onClick={confirmTemploPractice} 
                      style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                    >
                      Confirmar Progresso
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        )}

        {/* --- 4. PRÁTICA: RECITAÇÕES EM TELA CHEIA --- */}
        {isPracticeActive && (activePracticeId === 'recitarHonra' || activePracticeId === 'recitar7Fases') && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? '#0a0a14' : '#fdfbf7', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '600px', width: '100%' }}>
              <BookOpen size={64} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1.5rem', opacity: 0.8 }} />
              
              <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#d4af37' : '#6b4423', fontSize: '2.5rem', margin: '0 0 1.5rem 0' }}>
                {activePracticeId === 'recitarHonra' ? 'Código de Dignidade' : '7 Fases da ED'}
              </h2>
              
              <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(139, 115, 85, 0.05)', padding: '2rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, marginBottom: '3rem' }}>
                <p style={{ fontSize: '1.2rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.8', margin: 0, fontStyle: 'italic' }}>
                  Esta é uma prática de foro íntimo e sagrado. Faça sua recitação com atenção plena e propósito.
                  <br/><br/>
                  A tela permanecerá ativa para que o celular não bloqueie durante sua prática.
                </p>
              </div>

              <button 
                onClick={() => {
                  confirmImmersivePractice(activePracticeId);
                }} 
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.3rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)', transition: 'transform 0.2s', marginBottom: '1.5rem' }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <CheckCircle size={24} style={{ verticalAlign: 'middle', marginRight: '0.5rem', marginBottom: '2px' }} />
                Recitação Concluída
              </button>
              
              <button 
                onClick={() => { setIsPracticeActive(false); exitFullScreen(); }} 
                style={{ display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#b8a88a' : '#6b5744', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '1.1rem', textDecoration: 'underline' }}
              >
                Cancelar e Voltar
              </button>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIGURAÇÕES (HORÁRIOS) */}
        {showSettingsModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
              
              {/* Botão de Fechar */}
              <button onClick={() => setShowSettingsModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}>
                <X size={24} />
              </button>
              
              <Settings size={48} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 1.5rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.6rem' }}>Configurações</h2>
              
              {/* Escolha da Manhã */}
              <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: isDark ? '#d4af37' : '#6b4423', fontWeight: 'bold' }}>☀️ Horário do Prólogo</label>
                <select value={morningTime} onChange={(e) => setMorningTime(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>
                  {['05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              {/* Escolha da Noite */}
              <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: isDark ? '#d4af37' : '#6b4423', fontWeight: 'bold' }}>🌙 Horário do Epílogo</label>
                <select value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>
                  {['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.8rem', color: isDark ? '#b8a88a' : '#888', fontStyle: 'italic', lineHeight: '1.4' }}>
                  * Estes horários apenas organizam as janelas do seu diário. As notificações de lembrete no seu dispositivo estão atualmente <strong style={{ color: notificationsActive ? '#4caf50' : '#e74c3c' }}>{notificationsActive ? 'ATIVADAS' : 'DESATIVADAS'}</strong>.
                </p>
              </div>

              {/* Termo de Consentimento da IA */}
              <div style={{ textAlign: 'left', marginBottom: '2rem', padding: '1rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}` }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={aiConsent} 
                    onChange={async (e) => {
                      const consent = e.target.checked;
                      setAiConsent(consent);
                      if (user) await setDoc(doc(db, 'fvData', user.uid), { aiConsent: consent }, { merge: true });
                    }} 
                    style={{ width: '24px', height: '24px', marginTop: '0.2rem', cursor: 'pointer', accentColor: '#d4af37', flexShrink: 0 }} 
                  />
                  <span style={{ fontSize: '0.9rem', color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.4' }}>
                    <strong style={{ color: isDark ? '#d4af37' : '#6b4423' }}>Privacidade e Oráculo (IA):</strong> Autorizo o uso da Inteligência Artificial para ler meus registros de forma anônima <span style={{ textDecoration: 'underline' }}>apenas quando eu solicitar</span> uma análise (Batalha Interior, Missões ou Sínteses). Meus dados não são usados para treinar a máquina.
                  </span>
                </label>
              </div>

              {/* Botão de Salvar */}
              <button onClick={saveNotificationTimes} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                <Save size={20} /> Salvar Configurações
              </button>
              
            </div>
          </div>
        )}

      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', color: isDark ? '#b8a88a' : '#6b5744', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, marginTop: '2rem' }}>
        <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>"Que ninguém durma sem antes examinar as ações do dia"</p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Versos de Ouro de Pitágoras</p>
      </footer>
      
      {/* WIDGET FLUTUANTE DE TAREFAS GDVE (SÓ APARECE SE DESTRANCADO) */}
      {fvUnlocked && view !== 'fv' && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
          
          {/* Painel Aberto */}
          {showQuickFv && (
            <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(26, 26, 46, 0.95)' : 'rgba(253, 251, 247, 0.95)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', width: 'max-content', maxWidth: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Star size={16} /> Práticas Diárias</h4>
                <button onClick={() => setShowQuickFv(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#aaa' : '#777', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {fvGdveTasks.filter(t => !t.isCycle).length === 0 ? (
                   <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#888', fontStyle: 'italic' }}>Nenhuma prática diária pendente.</p>
                ) : (
                  fvGdveTasks.filter(t => !t.isCycle).map(task => {
                    const currentCount = (typeof fvDaily.gdveTasksStatus?.[task.id] === 'boolean' ? (fvDaily.gdveTasksStatus[task.id] ? 1 : 0) : fvDaily.gdveTasksStatus?.[task.id]) || 0;
                    const targetCount = task.target || 1;
                    const taskColor = getTaskColor(currentCount, targetCount, isDark);
                    
                    return (
                      <div key={task.id} onClick={() => toggleGdveTask(task)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', borderRadius: '8px', border: `1px solid ${taskColor}`, cursor: 'pointer', transition: 'all 0.2s', gap: '1rem' }}>
                        <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', fontWeight: currentCount >= targetCount ? 'bold' : 'normal' }}>{task.name}</span>
                        <div style={{ background: taskColor, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {currentCount}/{targetCount}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Botão Flutuante (A Estrela) */}
          <button onClick={() => setShowQuickFv(!showQuickFv)} style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <Star size={28} fill="#000" />
          </button>
        </div>
      )}
      
      

      {/* O EIXO DE KURUKSHETRA (TERMÔMETRO VISUAL DE CONSCIÊNCIA) */}
      {user && view === 'today' && (
        <>
          {/* WIDGET FLUTUANTE GRÁFICO (Responsivo: Celular vs PC) */}
          {isMobile ? (
            /* VERSÃO CELULAR: Botão Discreto no canto inferior esquerdo */
            <div 
              onClick={() => setShowConsciousnessModal(true)}
              style={{ position: 'fixed', left: '20px', bottom: '20px', zIndex: 9997, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} 
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: altitude >= 70 ? (isDark ? '#FFD700' : '#FFB300') : (altitude <= 30 ? '#e74c3c' : (isDark ? '#b8a88a' : '#8b7355')), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 15px ${altitude >= 70 ? 'rgba(255,215,0,0.4)' : (altitude <= 30 ? 'rgba(231,76,60,0.4)' : 'rgba(0,0,0,0.3)')}`, border: `2px solid ${isDark ? '#1a1a2e' : '#fff'}` }}>
                <Flame size={24} color={altitude >= 70 ? '#000' : '#fff'} />
              </div>
              <div style={{ background: isDark ? 'rgba(0,0,0,0.8)' : 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', color: altitude >= 70 ? (isDark ? '#FFD700' : '#d4af37') : (altitude <= 30 ? '#e74c3c' : (isDark ? '#f0e6d2' : '#2c1810')), marginTop: '-10px', zIndex: 2, border: `1px solid ${isDark ? 'rgba(255,215,0,0.3)' : 'rgba(139,115,85,0.2)'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                {altitude}%
              </div>
            </div>
          ) : (
            /* VERSÃO COMPUTADOR: O Eixo Vertical Completo */
            <div style={{ position: 'fixed', left: '20px', top: '150px', bottom: '100px', width: '60px', zIndex: 9997, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: '30px', padding: '10px 0', border: `1px solid ${isDark ? 'rgba(255,215,0,0.1)' : 'rgba(139,115,85,0.1)'}` }}>
              
              {/* O Topo: Krishna (Sattva / Sabedoria) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', opacity: altitude >= 80 ? 1 : 0.4, transition: 'opacity 0.5s' }}>
                <Sun size={28} color={isDark ? '#FFD700' : '#f39c12'} style={{ filter: altitude >= 80 ? 'drop-shadow(0 0 10px rgba(255,215,0,0.8))' : 'none' }} />
              </div>

              {/* O Eixo Invisível por onde o balão corre */}
              <div style={{ position: 'relative', width: '4px', flex: 1, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '10px 0', borderRadius: '2px' }}>
                
                {/* Arjuna (O Balão) Subindo e Descendo */}
                <div 
                  onClick={() => setShowConsciousnessModal(true)}
                  title="Elevar Consciência"
                  style={{ position: 'absolute', left: '50%', bottom: `${altitude}%`, transform: 'translate(-50%, 50%)', cursor: 'pointer', transition: 'bottom 1.5s cubic-bezier(0.25, 1, 0.5, 1)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: altitude >= 70 ? (isDark ? '#FFD700' : '#FFB300') : (altitude <= 30 ? '#e74c3c' : (isDark ? '#b8a88a' : '#8b7355')), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${altitude >= 70 ? '20px' : '10px'} ${altitude >= 70 ? 'rgba(255,215,0,0.6)' : (altitude <= 30 ? 'rgba(231,76,60,0.6)' : 'rgba(0,0,0,0.2)')}`, transition: 'all 0.5s' }}>
                    <Flame size={20} color={altitude >= 70 ? '#000' : '#fff'} />
                  </div>
                  <div style={{ width: '12px', height: '10px', background: isDark ? '#f0e6d2' : '#2c1810', borderRadius: '0 0 4px 4px', marginTop: '2px' }}></div>
                  <div style={{ background: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold', color: isDark ? '#f0e6d2' : '#2c1810', marginTop: '4px', border: `1px solid ${isDark ? 'rgba(255,215,0,0.3)' : 'rgba(0,0,0,0.1)'}` }}>
                    {altitude}%
                  </div>
                </div>
              </div>

              {/* O Chão: Kuravas (Tamas / Inércia) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', opacity: altitude <= 30 ? 1 : 0.4, transition: 'opacity 0.5s' }}>
                <Swords size={28} color="#e74c3c" style={{ filter: altitude <= 30 ? 'drop-shadow(0 0 10px rgba(231,76,60,0.8))' : 'none' }} />
              </div>
            </div>
          )}

          {/* O MODAL INTERATIVO (A LISTA RENOVÁVEL) */}
          {showConsciousnessModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }} onClick={closeConsciousnessModal}>
              
              <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '0', borderRadius: '16px', maxWidth: '500px', width: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', border: `2px solid ${altitude >= 70 ? '#FFD700' : (altitude <= 30 ? '#e74c3c' : '#8b7355')}`, overflow: 'hidden', boxShadow: '0 10px 50px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
                
                {/* CABEÇALHO GRÁFICO (Sem Placar) */}
                <div style={{ flexShrink: 0, background: altitude >= 70 ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,165,0,0.2))' : (altitude <= 30 ? 'linear-gradient(135deg, rgba(231,76,60,0.2), rgba(192,57,43,0.2))' : 'linear-gradient(135deg, rgba(139,115,85,0.1), rgba(107,68,35,0.1))'), padding: isMobile ? '1.5rem 1rem' : '2rem 1.5rem', textAlign: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, position: 'relative' }}>
                  <button onClick={closeConsciousnessModal} style={{ position: 'absolute', top: isMobile ? '0.75rem' : '1rem', right: isMobile ? '0.75rem' : '1rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={isMobile ? 20 : 24} /></button>
                  
                  {altitude >= 70 ? <Sun size={isMobile ? 36 : 48} color="#FFD700" style={{ margin: '0 auto 0.5rem' }} /> : (altitude <= 30 ? <Swords size={isMobile ? 36 : 48} color="#e74c3c" style={{ margin: '0 auto 0.5rem' }} /> : <Mountain size={isMobile ? 36 : 48} color="#8b7355" style={{ margin: '0 auto 0.5rem' }} />)}
                  
                  <h2 style={{ margin: '0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: isMobile ? '1.3rem' : '1.6rem' }}>
                    Estado de Consciência
                  </h2>
                </div>

                {/* ÁREA DE ROLAGEM INDEPENDENTE */}
                <div style={{ padding: isMobile ? '1rem' : '1.5rem', overflowY: 'auto', flex: 1 }}>
                  
                  {/* O DIÁLOGO ARQUETÍPICO */}
                  <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f5f5f5', padding: isMobile ? '0.8rem' : '1.2rem', borderRadius: '12px', borderLeft: `4px solid ${altitude >= 70 ? '#FFD700' : (altitude <= 30 ? '#e74c3c' : '#8b7355')}`, marginBottom: isMobile ? '1rem' : '1.5rem' }}>
                    {altitude <= 30 ? (
                      <p style={{ margin: 0, fontStyle: 'italic', fontSize: isMobile ? '0.85rem' : '1rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.5' }}><strong>Kuravas:</strong> "Sim... continue reagindo e ignorando suas práticas. A gravidade é o nosso domínio. Deixe a mente afundar na matéria."</p>
                    ) : altitude >= 70 ? (
                      <p style={{ margin: 0, fontStyle: 'italic', fontSize: isMobile ? '0.85rem' : '1rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.5' }}><strong>Krishna:</strong> "Sua mente repousa no alto, firme como chama sem vento. Mantenha a vigília."</p>
                    ) : (
                      <p style={{ margin: 0, fontStyle: 'italic', fontSize: isMobile ? '0.85rem' : '1rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.5' }}><strong>A Voz da Consciência:</strong> "A batalha está empatada. Você não caiu, mas não se ergueu à luz. Qual a próxima ação?"</p>
                    )}
                  </div>

                  {/* CONEXÃO COM O ORÁCULO OU LISTA DE AÇÕES */}
                  {!balloonActions ? (
                    <div style={{ textAlign: 'center', padding: isMobile ? '1rem' : '1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)', borderRadius: '12px', border: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, marginBottom: isMobile ? '1rem' : '1.5rem' }}>
                      <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: isMobile ? '0.85rem' : '0.95rem', marginBottom: '1rem', fontStyle: 'italic', lineHeight: '1.4' }}>
                        A máquina precisa auditar suas entrelinhas para extrair as reflexões de hoje.
                      </p>
                      <button 
                        onClick={generateBalloonActions} 
                        disabled={isGeneratingBalloon}
                        style={{ padding: '0.8rem 1rem', background: isGeneratingBalloon ? 'transparent' : (isDark ? '#d4af37' : '#6b4423'), color: isGeneratingBalloon ? (isDark ? '#d4af37' : '#6b4423') : (isDark ? '#1a1a2e' : 'white'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: isGeneratingBalloon ? 'wait' : 'pointer', fontWeight: 'bold', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', transition: 'all 0.3s ease', fontSize: isMobile ? '0.85rem' : '0.95rem' }}
                      >
                        {isGeneratingBalloon ? <Sparkles className="animate-spin" size={18} /> : <Target size={18} />}
                        {isGeneratingBalloon ? 'Lendo a sua Alma...' : 'Conectar ao Oráculo (IA)'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {displayedActions.length > 0 && (
                        <div style={{ marginBottom: '1.2rem' }}>
                          <p style={{ margin: '0 0 0.3rem 0', fontSize: isMobile ? '0.85rem' : '0.95rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>Confesse as ações de hoje:</p>
                          <p style={{ margin: 0, fontSize: isMobile ? '0.75rem' : '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>Analise a afirmação e declare o que de fato aconteceu no seu dia.</p>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.8rem' : '1rem', marginBottom: isMobile ? '1rem' : '1.5rem' }}>
                        {displayedActions.map(action => {
                          const isAnimating = animatingActionId === action.id;
                          const currentType = isAnimating ? animatingType : null;
                          
                          return (
                            <div key={action.id} style={{ 
                              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', 
                              border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, 
                              borderRadius: '10px', padding: isMobile ? '0.8rem' : '1rem', 
                              display: 'flex', flexDirection: 'column', gap: '0.8rem',
                              transform: isAnimating ? 'scale(0.98)' : 'scale(1)',
                              transition: 'all 0.3s ease',
                              boxShadow: isAnimating ? '0 0 15px rgba(212, 175, 55, 0.2)' : 'none'
                            }}>
                              
                              <span style={{ fontSize: isMobile ? '0.85rem' : '0.95rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.4', fontStyle: 'italic', textAlign: 'center' }}>
                                "{action.text}"
                              </span>
                              
                              {/* OS TRÊS CAMINHOS DA AÇÃO */}
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                                
                                <button 
                                  onClick={() => handleInteraction(action, 1, 'sim')}
                                  disabled={animatingActionId !== null}
                                  style={{ flex: 1, padding: '0.5rem', background: currentType === 'sim' ? (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)') : 'transparent', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.4)' : 'rgba(139, 115, 85, 0.4)'}`, borderRadius: '6px', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: isMobile ? '0.7rem' : '0.8rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <CheckCircle size={16} /> Sim
                                </button>
                                
                                <button 
                                  onClick={() => handleInteraction(action, -1, 'oposto')}
                                  disabled={animatingActionId !== null}
                                  style={{ flex: 1, padding: '0.5rem', background: currentType === 'oposto' ? (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)') : 'transparent', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.4)' : 'rgba(139, 115, 85, 0.4)'}`, borderRadius: '6px', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: isMobile ? '0.7rem' : '0.8rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <Swords size={16} /> Agi Diferente
                                </button>
                                
                                <button 
                                  onClick={() => handleInteraction(action, 0, 'pular')}
                                  disabled={animatingActionId !== null}
                                  style={{ flex: 1, padding: '0.5rem', background: currentType === 'pular' ? 'rgba(150, 150, 150, 0.2)' : 'transparent', border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`, borderRadius: '6px', color: isDark ? '#b8a88a' : '#6b5744', fontSize: isMobile ? '0.7rem' : '0.8rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <X size={16} /> Não Ocorreu
                                </button>

                              </div>
                            </div>
                          );
                        })}

                        {displayedActions.length === 0 && (
                          <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '1.5rem 1rem', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}` }}>
                            <CheckCircle size={24} color={isDark ? '#d4af37' : '#6b4423'} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                            <p style={{ margin: 0, color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic', fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
                              O poço de reflexões esgotou. Retorne à batalha para revelar as consequências dos seus atos.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
                  <button onClick={closeConsciousnessModal} style={{ width: '100%', padding: isMobile ? '0.75rem' : '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                    Retornar à Batalha
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* BANNER DE INSTALAÇÃO DO PWA (ALTO CONTRASTE) */}
      {showInstallBanner && (
        <div className="animate-fadeIn" style={{ 
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 
          background: isDark ? 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)' : 'linear-gradient(135deg, #1e272e 0%, #2c3e50 100%)', 
          padding: '1rem 1.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '1rem', 
          boxShadow: isDark ? '0 10px 30px rgba(255, 140, 0, 0.4)' : '0 15px 35px rgba(0,0,0,0.5)', 
          zIndex: 10000, width: 'max-content', maxWidth: '95%' 
        }}>
          <Download size={28} color={isDark ? '#000' : '#FFD700'} style={{ flexShrink: 0 }} />
          <div style={{ color: isDark ? '#000' : 'white', fontFamily: 'Georgia, serif', textAlign: 'left' }}>
            <strong style={{ display: 'block', fontSize: '1.1rem', lineHeight: '1.2', textTransform: 'uppercase', letterSpacing: '1px' }}>Instalar o Diário</strong>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>Tenha o aplicativo na sua tela inicial!</span>
          </div>
          <button onClick={handleInstallClick} style={{ padding: '0.6rem 1.2rem', background: isDark ? '#000' : '#FFD700', color: isDark ? '#FFD700' : '#000', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '0.5rem', flexShrink: 0, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>Instalar</button>
          <button onClick={() => setShowInstallBanner(false)} style={{ background: 'transparent', border: 'none', color: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>
      )}


    </div>
  );
}

export default App;