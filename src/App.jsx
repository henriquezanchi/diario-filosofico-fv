import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sunrise, Sunset, Search, Calendar, Moon, Sun, 
  Sparkles, ChevronRight, LogOut, Shuffle, Plus, X, 
  AlertCircle, Eye, EyeOff, CheckCircle, Download, Upload,
  Target, TrendingUp, Award, FileText, Book, Settings,
  Trash2, Edit, Save, XCircle, Flame, Zap, Shield, Star, Crown, 
  Bell, Check, Music, MessageSquare, Menu, Lock, ChevronDown, ChevronUp, 
  Mountain, Landmark, Swords, Bookmark, Library, MessageCircle, Camera,
  Clock, ChevronLeft, Smartphone, ShieldAlert, ArrowLeft
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

import { 
  DEFAULT_FV_DAILY, 
  BASTIOES_DB, 
  virtues, 
  philosophicalQuotes, 
  studyTips 
} from './constants/data';

import { translateCategory } from './constants/bookMetrics';
import { AUTHOR_CANON, getReadingRank, getFavoriteTheme, getAuthorStats } from './constants/ranks';

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

  // --- ESTADOS DE SEGURANÇA FV (ANTE-SALA) ---
  const [fvAccessStatus, setFvAccessStatus] = useState('checking'); // 'checking', 'approved', 'pending', 'unregistered'
  const [requestName, setRequestName] = useState('');
  const [requestUnit, setRequestUnit] = useState('');

  // --- Estado da Central de Notificação (Guardião) ---
  const [notifSettings, setNotifSettings] = useState({
    whatsappNumber: '',
    notifMorningTime: '07:30',
    notifNightTime: '21:00',
    alerts: {
      dailyVirtue: true,
      dailyEpilogue: true,
      pendingTasks: true,
      readingSlump: true,
      practiceSlump: true,
      diarySlump: true,
      gdveWarning: true,
      randomVirtue: false
    }
  });

  const [saveBtnStatus, setSaveBtnStatus] = useState('idle'); // 'idle', 'saving', 'success'

  const saveNotificationSettings = async () => {
    if (!user) return;
    setSaveBtnStatus('saving'); // Muda o botão para "Salvando..."
    try {
      await setDoc(doc(db, 'users', user.uid), { notifications: notifSettings }, { merge: true });
      setSaveBtnStatus('success'); // Muda o botão para Verde (Sucesso)
      setTimeout(() => setSaveBtnStatus('idle'), 3000); // Volta ao normal após 3 segundos
    } catch (e) {
      console.error("Erro ao salvar notificações:", e);
      alert("Erro ao salvar as configurações.");
      setSaveBtnStatus('idle');
    }
  };

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
  const [showPracticesModal, setShowPracticesModal] = useState(false);

  // Streaks da FV
  const [fvDiaryStreak, setFvDiaryStreak] = useState(0);
  const [fvTasksStreak, setFvTasksStreak] = useState(0);

  // Controles do Menu Mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDiaryMenu, setShowDiaryMenu] = useState(false);
  const [showPracticesMenu, setShowPracticesMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850);

 
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
  const [dailyStudyTip, setDailyStudyTip] = useState(null);
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

  // Controles de Expansão dos Blocos do Discipulado (Iniciam Fechados)
  const [isGdvePlanOpen, setIsGdvePlanOpen] = useState(false);
  const [isGdveMóduloOpen, setIsGdveMóduloOpen] = useState(false);
  const [isGdveDesafiosOpen, setIsGdveDesafiosOpen] = useState(false);

  // --- ESTADOS FIXOS (PERFIL FV - Preenchidos apenas uma vez) ---
  const [fvUnidade, setFvUnidade] = useState('');
  const [fvCondicao, setFvCondicao] = useState('');
  const [fvDestinatarioCd, setFvDestinatarioCd] = useState('');

  // --- CALENDÁRIO FIXO DE ATIVIDADES ---
  const [fvCalendar, setFvCalendar] = useState({
    aulaRegularDia: '', aulaRegularHora: '', aulaRegularFim: '',
    reuniaoRaioDia: '', reuniaoRaioHora: '', reuniaoRaioFim: '',
    aulaMinistradaDias: [], aulaMinistradaHora: '', aulaMinistradaFim: '',
    dataAulaEd: '', aulaEdHora: '', aulaEdFim: '',
    dataCrm: '', crmHora: '', crmFim: ''
  });

  // Função auxiliar para marcar/desmarcar múltiplos dias de aula ministrada e seus horários
  const handleDiasMinistradosToggle = (diaStr) => {
    setFvCalendar(prev => {
      const dias = prev.aulaMinistradaDias || [];
      const tempos = prev.aulaMinistradaTempos || {};
      
      if (dias.includes(diaStr)) {
        // Se já estava marcado, remove o dia e apaga o horário dele
        const newDias = dias.filter(d => d !== diaStr);
        const newTempos = { ...tempos };
        delete newTempos[diaStr];
        return { ...prev, aulaMinistradaDias: newDias, aulaMinistradaTempos: newTempos };
      } else {
        // Se não estava marcado, adiciona o dia e cria um campo de horário vazio para ele
        return { 
          ...prev, 
          aulaMinistradaDias: [...dias, diaStr],
          aulaMinistradaTempos: { ...tempos, [diaStr]: { inicio: '', fim: '' } }
        };
      }
    });
  };

  // --- ESTADOS DINÂMICOS DO RELATÓRIO MENSAL FV ---
  const [isGdveRelatorioOpen, setIsGdveRelatorioOpen] = useState(false);
  const [monthlyReport, setMonthlyReport] = useState({
    // Ideológico
    crmMensal: '', reunioesRaio: '', outrasCrm: '', bastioesLidos: '',
    // Escolástica
    diasAula: '', praticasPsicologia: '', estudandoMaterias: '', livroFilosofico: '',
    // Voluntariado
    frequenciaVoluntariado: '', fezGn: '', ministrouAulas: '', escalasLimpeza: '', propaganda: [],
    // Financeiro
    contribuicao: '', doacao: '',
    // Secretarias
    secretariaAtuacao: '', secretariaReuniao: '', secretariaMembros: '',
    // Análise e Reflexão
    pontosPositivos: '', desafioCrescimento: ''
  });

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
  const isEnrichingRef = useRef(false);
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
  const [expandedCartaItems, setExpandedCartaItems] = useState({});

  // Controles de Expansão dos Blocos do Diário (Iniciam Fechados)
  const [isPrologoOpen, setIsPrologoOpen] = useState(true);
  const [isPraticasOpen, setIsPraticasOpen] = useState(false);
  const [isEscaladaOpen, setIsEscaladaOpen] = useState(false);
  const [isEpilogoOpen, setIsEpilogoOpen] = useState(false);

  // --- ESTADOS DE LEITURA E ESTUDOS ---
  const [books, setBooks] = useState([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', author: '', currentPage: 0, totalPages: 0, link: '', notes: '' });
  const [shelfSearchTerm, setShelfSearchTerm] = useState(''); // Estado para busca na estante
  const [editingBookId, setEditingBookId] = useState(null);
  const [expandedNotesId, setExpandedNotesId] = useState(null);
  const [isVirtuesOpen, setIsVirtuesOpen] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [bookRecommendation, setBookRecommendation] = useState(null);
  const [isScanningShelf, setIsScanningShelf] = useState(false);
  const [detectedBooks, setDetectedBooks] = useState([]);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [isAwaitingScan, setIsAwaitingScan] = useState(false);
  const [scanNotification, setScanNotification] = useState(null); // { count: 0, show: false }
  const [discardedSuggestions, setDiscardedSuggestions] = useState([]); // Memória do Oráculo
  const [selectedForDeletion, setSelectedForDeletion] = useState([]); // Exclusão em lote
  const [showReadBooks, setShowReadBooks] = useState(false); // Gaveta sanfona de Lidos
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const AMAZON_AFFILIATE_ID = 'filosofiae0a5-20'; // 
  const totalForgedPages = books.reduce((acc, book) => acc + (book.currentPage || 0), 0);
  const [taskReminderTime, setTaskReminderTime] = useState('10:00');
  const getStalledBook = () => {
    const thresholdDays = 3; // Considera estagnado após 3 dias sem mexer
    return books.find(b => {
      if (b.status !== 'lendo' || !b.updatedAt) return false;
      const diff = (new Date() - new Date(b.updatedAt)) / (1000 * 60 * 60 * 24);
      return diff >= thresholdDays;
    });
  };

    // --- O OPERÁRIO INVISÍVEL (BACKGROUND WORKER) ---
  useEffect(() => {
    const enrichNextBook = async () => {
      const pendingBook = books.find(b => b.isPendingEnrichment);

      // Se não há livro pendente, se já está buscando, ou se já está enriquecendo: para aqui
      if (!pendingBook || isSearchingBooks || isEnrichingRef.current) return;

      // Levanta a bandeira: "estou trabalhando, não me interrompa"
      isEnrichingRef.current = true;

      try {
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
            pendingBook.title + ' ' + pendingBook.author
          )}&maxResults=1&langRestrict=pt`
        );

        if (res.status === 429) {
          console.warn("Operário: Google Books pediu para ir mais devagar. Pausando.");
            isEnrichingRef.current = false; // abaixa a bandeira manualmente aqui
          return;
        }

        const json = await res.json();
        const info = json.items?.[0]?.volumeInfo;

        const updatedBooks = books.map(b => {
          if (b.id !== pendingBook.id) return b;
          return {
            ...b,
            totalPages: info?.pageCount || b.totalPages,
            currentPage: b.status === 'lido' ? (info?.pageCount || 0) : b.currentPage,
            thumbnail: info?.imageLinks?.thumbnail?.replace('http:', 'https:') || b.thumbnail,
            category: translateCategory(info?.categories?.[0] || b.category),
            isPendingEnrichment: false
          };
        });

        // Salva sem chamar saveBooksToDb para não disparar o loop
        const livrosSanitizados = JSON.parse(JSON.stringify(updatedBooks));
        setBooks(livrosSanitizados);
        if (user) {
          await setDoc(
            doc(db, 'userBooks', user.uid),
            { books: livrosSanitizados },
            { merge: true }
          );
        }
        console.log(`Operário: Dados de "${pendingBook.title}" atualizados.`);

      } catch (e) {
        console.error("Erro no operário:", e);
      } finally {
        // Abaixa a bandeira: "terminei, pode chamar de novo se precisar"
        isEnrichingRef.current = false;
      }
    };

    const timer = setTimeout(enrichNextBook, 6000);
    return () => clearTimeout(timer);
  }, [books, isSearchingBooks, user]);
   
  const favoriteTheme = getFavoriteTheme();
  const finishedBooksCount = books.filter(b => b.totalPages > 0 && b.currentPage >= b.totalPages).length;
    
  // Estado Diário da Carta de Degrau FV
  const [fvDaily, setFvDaily] = useState(DEFAULT_FV_DAILY);
  const [todayFvDaily, setTodayFvDaily] = useState(DEFAULT_FV_DAILY); // NOVO

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
      todayTasksStatus, fvDaily, customTasks
    };
  }, [user, selectedDate, selectedVirtue, customVirtue, showCustomVirtue, dailyIntention,
      whereIFailed, whatIDidWell, whatILeftUndone, freeEpilogue, didMorning,
      morningDone, eveningDone, todayTasksStatus, fvDaily, customTasks]);

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
      tasksSnapshot: (data.customTasks || [])
        .filter(task => {
          if (!task.recurrence || task.recurrence === 'daily') return true;
          const d = new Date(data.selectedDate + 'T12:00:00');
          if (task.recurrence === 'weekly') return task.weekDays?.includes(d.getDay());
          if (task.recurrence === 'monthly') return parseInt(task.monthDay) === d.getDate();
          return true;
        })
        .map(task => ({
          id: task.id, name: task.name, completed: !!(data.todayTasksStatus || {})[task.id]
        })),
      fvDaily: data.fvDaily || DEFAULT_FV_DAILY
    };

    try {
      await setDoc(doc(db, 'entries', `${data.user.uid}_${data.selectedDate}`), updatePayload, { merge: true });
    } catch (e) {
      console.log('Erro no autosave silencioso:', e);
    }
  };

    const performSilentAutoSaveRef = useRef(null);
  useEffect(() => {
    performSilentAutoSaveRef.current = performSilentAutoSave;
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (performSilentAutoSaveRef.current) {
        performSilentAutoSaveRef.current();
      }
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
    setFvDaily(DEFAULT_FV_DAILY);
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
    // 1. Leva para a aba Diário e sobe a tela
    setView('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. Mantém a trava de segurança oculta dos cliques
    setFvClickCount(prev => prev + 1);
    if (fvClickCount >= 6) {
      setFvUnlocked(true);
      loadMod2Config(user?.uid);
      setFvClickCount(0);
      alert('🔓 Modo FV ativado na sessão!');
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
      let userData = userDoc.exists() ? userDoc.data() : null;

      // O LEÃO DE CHÁCARA: Verifica se o e-mail está na Lista VIP
        let isVip = false;
        // Pega o usuário DIRETAMENTE da catraca de autenticação, evitando o atraso do React
        const currentUserLogado = auth.currentUser; 
        
        if (currentUserLogado && currentUserLogado.email) {
          const whitelistDoc = await getDoc(doc(db, 'admin', 'whitelist'));
          if (whitelistDoc.exists()) {
            const allowedEmails = whitelistDoc.data().emails || [];
            // Converte tudo para minúsculo para evitar erros de digitação
            if (allowedEmails.map(e => e.toLowerCase()).includes(currentUserLogado.email.toLowerCase())) {
              isVip = true;
            }
          }
        }

        if (userData) {
        setTheme(userData.theme || 'light');
        setLastDrawDate(userData.lastDrawDate || null);
        setMorningTime(userData.morningTime || '06:00'); 
        setEveningTime(userData.eveningTime || '22:00');
        
        // Carrega as configurações do Guardião salvas
        if (userData.notifications) {
          setNotifSettings(userData.notifications);
        }
        
        if ('Notification' in window && Notification.permission === 'granted') {
          setNotificationsActive(!!userData.fcmToken);
        } else {
          setNotificationsActive(false);
        }

        // Se o usuário está na lista VIP, mas o perfil dele ainda não sabe, aprovamos na marra!
        if (isVip && userData.fvStatus !== 'approved') {
          await updateDoc(doc(db, 'users', uid), { fvStatus: 'approved' });
          userData.fvStatus = 'approved';
        }

        // LÓGICA DA ANTE-SALA FV
        if (userData.fvStatus === 'approved') {
          setFvAccessStatus('approved');
          setFvUnlocked(true); // Destranca as portas do Templo
          loadMod2Config(uid);    // Inicia o motor GDVE
        } else if (userData.fvStatus === 'pending') {
          setFvAccessStatus('pending');
          setFvUnlocked(false);
        } else {
          setFvAccessStatus('unregistered');
          setFvUnlocked(false);
        }

      } else {
        // Usuário totalmente novo criando conta
        const initialStatus = isVip ? 'approved' : 'unregistered';
        
        await setDoc(doc(db, 'users', uid), {
          createdAt: Timestamp.now(), theme: 'light', lastDrawDate: null, 
          fvUnlocked: isVip,
          fvStatus: initialStatus, email: user?.email || 'Sem e-mail'
        });
        
        setFvAccessStatus(initialStatus);
        setFvUnlocked(isVip);
        if (isVip) loadMod2Config(uid);
      }
    } catch (error) { console.error('Erro ao carregar dados:', error); }
  };


  
  const handleRequestAccess = async () => {
    if (!requestName.trim() || !requestUnit.trim()) return alert("Por favor, preencha seu nome e a unidade.");
    try {
      // 1. Salva no banco de dados
      await setDoc(doc(db, 'users', user.uid), {
        fvStatus: 'pending',
        requestName: requestName.trim(),
        requestUnit: requestUnit.trim(),
        requestDate: Timestamp.now()
      }, { merge: true });
      
      setFvAccessStatus('pending');

      // 2. Dispara o aviso para o Diretor via WhatsApp
      const adminPhone = "5562991729783"; // Seu número
      const text = encodeURIComponent(`*Novo Pedido de Acesso - Diário FV* 🛡️\n\n*Nome:* ${requestName.trim()}\n*Unidade:* ${requestUnit.trim()}\n*E-mail:* ${user.email}\n\nPor favor, acesse o Firebase para liberar o meu perfil.`);
      window.open(`https://wa.me/${adminPhone}?text=${text}`, '_blank');

    } catch (e) {
      alert("Erro ao enviar a solicitação. Tente novamente.");
    }
  };

  const handleBulkAddWhitelist = async (rawText) => {
    if (!rawText.trim()) return alert("Cole a lista de e-mails primeiro.");

    // Transforma o texto em uma lista limpa, removendo espaços e tratando vírgulas ou quebras de linha
    const emailList = rawText
      .split(/[\n,]+/)
      .map(e => e.replace(/["']/g, "").trim().toLowerCase()) // Remove aspas simples e duplas
      .filter(e => e.includes('@'));

    if (emailList.length === 0) return alert("Nenhum e-mail válido encontrado.");

    try {
      const whitelistRef = doc(db, 'admin', 'whitelist');
      await setDoc(whitelistRef, { emails: emailList }, { merge: true });
      alert(`✅ Sucesso! ${emailList.length} e-mails foram importados para a Lista VIP.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar no Firebase. Verifique suas permissões.");
    }
  };

  const loadTodayEntry = async (uid, dateToLoad = null) => {
    try {
      const targetDate = dateToLoad || selectedDate;
      const entryDoc = await getDoc(doc(db, 'entries', `${uid}_${targetDate}`));
      
      if (entryDoc.exists()) {
        const data = entryDoc.data();
        setMorningDone(data.morningDone || false);
        setIsPrologoOpen(!(data.morningDone || false));
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
        setFvDaily(data.fvDaily || DEFAULT_FV_DAILY);
        // Só atualiza o "hoje real" se for de fato o dia de hoje
          const todayKey = getTodayKey();
          if (!dateToLoad || dateToLoad === todayKey) {
            setTodayFvDaily(data.fvDaily || DEFAULT_FV_DAILY);
          }

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
      if (!dailyStudyTip) {
        const randomTip = studyTips[Math.floor(Math.random() * studyTips.length)];
        setDailyStudyTip(randomTip);
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
        setDiscardedSuggestions(docSnap.data().discardedSuggestions || []);
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
    if(!aiConsent) return alert('Autorize a IA nas Configurações.');

    // 1. Inicia o modo silencioso e FECHA qualquer modal aberto
    setIsAwaitingScan(true);
    setShowScannerModal(false); 
    setScanNotification(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = reader.result.split(',')[1];
      const prompt = `Atue como um bibliotecário especialista. Analise esta imagem de capas ou lombadas de livros. Identifique cada obra. Tente extrair: Título, Autor e Editora. Retorne ESTRITAMENTE um array JSON de objetos: [{"title": "Título", "author": "Autor", "publisher": "Editora"}]`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64String } }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json();
        const detected = JSON.parse(data.candidates[0].content.parts[0].text);
        
        // 2. Guarda os resultados mas NÃO abre o modal ainda
        setDetectedBooks(detected.map(b => ({ ...b, isPending: true })));
        
        // 3. Dispara a notificação de sucesso
        setScanNotification({ count: detected.length, show: true });
      } catch(err) {
        console.error("Erro no Escaner Silencioso:", err);
        alert("O Oráculo se distraiu. Tente outra foto.");
      } finally {
        setIsAwaitingScan(false);
        e.target.value = null;
      }
    };
  };

  // --- PROCESSADOR RÁPIDO DO ESCANER ---
  const dismissDetectedBook = (title) => {
    setDetectedBooks(prev => prev.filter(b => b.title !== title));
  };

  const handleQuickAdd = (detectedBook, status) => {
    const newBook = {
      id: `book_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: detectedBook.title,
      author: detectedBook.author,
      publisher: detectedBook.publisher || null,
      totalPages: 0, 
      currentPage: 0, 
      thumbnail: null, 
      category: 'Filosofia',
      isPendingEnrichment: true, 
      status: status // 'lido', 'lendo', 'juro' (já tenho), 'desejo' (quero comprar)
    };

    if (status === 'lido') {
      newBook.finishedDate = new Date().toISOString();
    } else if (status === 'lendo') {
      const input = prompt(`Em qual página você está de "${detectedBook.title}"?`, '0');
      newBook.currentPage = parseInt(input) || 0;
    }

    saveBooksToDb([newBook, ...books]);
    dismissDetectedBook(detectedBook.title);
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
    LIVROS PROIBIDOS DE SUGERIR (Ele já descartou): ${discardedSuggestions.join(', ')}.
    
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
        
        // RELIGADOR: Puxa o dado independente se a etiqueta tem o prefixo 'fv' ou não
        setFvLastCartaDate(data.fvLastCartaDate || data.lastCartaDate || '');
        setFvNextCartaDate(data.fvNextCartaDate || data.nextCartaDate || '');
        setFvGdveReuniao(data.fvGdveReuniao || data.gdveReuniao || '');
        setFvMasterName(data.fvMasterName || data.masterName || '');
        setFvLastMeetingDate(data.fvLastMeetingDate || data.lastMeetingDate || '');
        setFvCalendar(data.fvCalendar || { 
          aulaRegularDia: '', aulaRegularHora: '', aulaRegularFim: '',
          reuniaoRaioDia: '', reuniaoRaioHora: '', reuniaoRaioFim: '',
          aulaMinistradaDias: [], aulaMinistradaHora: '', aulaMinistradaFim: '',
          dataAulaEd: '', aulaEdHora: '', aulaEdFim: '',
          dataCrm: '', crmHora: '', crmFim: '' 
        });
        
        // --- NOVOS DADOS FIXOS DO PERFIL ---
        setFvUnidade(data.fvUnidade || '');
        setFvCondicao(data.fvCondicao || '');
        setFvDestinatarioCd(data.fvDestinatarioCd || '');

        setFvGdveTasks(data.gdveTasks || []);
        setFvGdveCycleStatus(data.gdveCycleStatus || {});
        setFvGdveBastiaoName(data.fvGdveBastiaoName || data.bastiaoName || '');
        setFvGdveBastiaoLink(data.fvGdveBastiaoLink || data.bastiaoLink || '');
        
        setKuravaEnabled(data.kuravaEnabled !== false);
        setAiConsent(data.aiConsent || false);
        setDiscipularSynthesis(data.discipularSynthesis || null);
        setTechnicalSynthesis(data.technicalSynthesis || null);
      }
    } catch (error) {
      console.error("Erro ao carregar dados da nuvem:", error);
    } finally {
      setIsCloudDataLoaded(true); 
    }
  };


  const loadMod2Config = async (currentUserUid = null) => {
    // Usamos o UID passado ou o do state (para lidar com o assincronismo do Firebase)
    const uidToUse = currentUserUid || (user ? user.uid : null);
    if (!uidToUse) return; 

    setIsDownloadingConfig(true);
    try {
      const docRef = doc(db, 'fvData', uidToUse);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().config) {
        setFvConfig(docSnap.data().config);
      } else {
        const initialConfig = {
          tituloAba: "Registro de Ciclo",
          secaoReflexao: "Degrau (A Escalada - Reflexões)",
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
        tasksSnapshot: tasksSnapshot || [], eveningTimestamp: Timestamp.now(),
        fvDaily: fvDaily // <-- ISSO GARANTE QUE AS PRESENÇAS SEJAM SALVAS
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
        fvMasterName: fvMasterName,
        fvLastMeetingDate: fvLastMeetingDate,
        fvUnidade: fvUnidade,
        fvCondicao: fvCondicao,
        fvCalendar: fvCalendar // <--- Esta linha salva o objeto inteiro com os novos horários
      }, { merge: true });
      alert("✅ Acompanhamento Discipular salvo com sucesso!");
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

      // Conta as práticas silenciosas do FV
      const countPractices = (ciclo) => { let total = 0; ciclo.forEach(e => { if(e.fvDaily && e.fvDaily.praticas) { total += Object.values(e.fvDaily.praticas).filter(v => v === true).length; } }); return total; };

      let dossie = `DADOS ESTATÍSTICOS DO USUÁRIO:\n\n`;
      dossie += `[CICLO ANTERIOR: Dias -60 a -31]\n- Preenchimentos Diário: ${cicloAnterior.length}\n- Práticas FV: ${countPractices(cicloAnterior)}\n\n`;

      dossie += `[CICLO ATUAL: Últimos 30 dias]\n- Preenchimentos Diário: ${cicloAtual.length}\n- Práticas FV: ${countPractices(cicloAtual)}\n`;
      dossie += `- COMPORTAMENTO DE AUTOEXAME: Dos ${epilogosAtual.length} epílogos, ${evasaoVazia} foram deixados em branco e ${evasaoParcial} foram parciais.\n`;
      
      dossie += `- ONDE FALHOU (Diário comum): ${cicloAtual.filter(e => e.whereIFailed).map(e => e.whereIFailed).join(' | ')}\n`;
      dossie += `- TEXTO LIVRE (Epílogo): ${cicloAtual.filter(e => e.freeEpilogue).map(e => e.freeEpilogue).join(' | ')}\n`;

      // INJETANDO O OURO ALQUÍMICO (DADOS FV)
      const fvItem1 = cicloAtual.filter(e => e.fvDaily && e.fvDaily.item1).map(e => e.fvDaily.item1).join(' | ');
      const fvItem6 = cicloAtual.filter(e => e.fvDaily && e.fvDaily.item6).map(e => e.fvDaily.item6).join(' | ');
      
      // Coletando as Leis da Matéria divididas
      let fvItem2Materia = '';
      cicloAtual.forEach(e => {
          if(e.fvDaily) {
              const subKeys = ['instintos', 'idade', 'enfermidade', 'animo', 'humor', 'ideias', 'sentimentos', 'ambiente'];
              subKeys.forEach(k => {
                 if(e.fvDaily[`item2_${k}`]) fvItem2Materia += `(${k}): ${e.fvDaily[`item2_${k}`]} | `;
              });
              if(e.fvDaily.item2) fvItem2Materia += e.fvDaily.item2 + ' | '; // Pega textos antigos se houver
          }
      });

      dossie += `- FV VARRER POR DENTRO (Item 1): ${fvItem1}\n`;
      dossie += `- FV VÍCIOS E NEGLIGÊNCIAS (Item 6): ${fvItem6}\n`;
      dossie += `- FV LEIS DA MATÉRIA (Item 2): ${fvItem2Materia}\n`;

      const termoMestre = fvMasterName ? `o seu Instrutor (${fvMasterName})` : "o seu Instrutor";

      const prompt = `Você é um Analista de Dados e Mentor Filosófico. Retorne ESTRITAMENTE um objeto JSON válido (sem formatação Markdown e sem blocos de código).

      REGRAS DE CONTEÚDO:
      - NÃO dê conselhos morais clichês. Aja como um auditor imparcial e cirúrgico.
      - Analise os DADOS ESTATÍSTICOS cruzando-os com os textos densos das Práticas FV ("Varrer por Dentro", "Vícios", "Leis da Matéria").
      - O objetivo é extrair o ouro alquímico: os padrões de queda e ascensão da consciência do aluno neste ciclo.

      O JSON deve conter EXATAMENTE as seguintes chaves:
      "guardaBaixou": Uma síntese fria dos padrões recorrentes onde o usuário falhou, cedeu aos vícios (Item 6) ou foi dominado pelas Leis da Matéria (Item 2). (Máximo 4 linhas).
      "conquistas": Uma síntese técnica dos padrões de acerto, virtudes executadas e aumento da Vontade/Práticas FV (Máximo 4 linhas).
      "investigacoes": Um mapeamento de hipóteses, causas e "nós psíquicos" que o usuário expressou predominantemente no "Varrer por Dentro" (Item 1) e no Texto Livre (Máximo 4 linhas).
      "sinteseGeral": Um relatório de 2 parágrafos: O primeiro avaliando o comportamento de preenchimento, evasão e constância comparando o ciclo atual com o anterior. O segundo sugerindo 2 perguntas técnicas precisas e desconfortáveis para ele levar para a reunião de acompanhamento com ${termoMestre}.

      DADOS DO CICLO:
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

  const handleMonthlyReportChange = (field, value) => {
    setMonthlyReport(prev => ({ ...prev, [field]: value }));
  };

  const handlePropagandaToggle = (value) => {
    setMonthlyReport(prev => {
      const current = prev.propaganda || [];
      return {
        ...prev,
        propaganda: current.includes(value) ? current.filter(item => item !== value) : [...current, value]
      };
    });
  };

  const generateMonthlyReportText = () => {
    // CORREÇÃO: Agora ele chama o motor novo (Stats) em vez do antigo (Totals)
    const stats = getFvMonthlyStats(); 
    const hoje = new Date();
    const mesAno = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    // Filtra as entradas dos últimos 30 dias
    const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(hoje.getDate() - 30);
    const cicloEntries = entries.filter(e => new Date(e.date + 'T12:00:00') >= trintaDiasAtras);
    
    // 1. DADOS CALCULADOS MATEMATICAMENTE
    const diasFeitos = cicloEntries.filter(e => e.morningDone).length;
    let freqDiario = "Nunca - Não fez nenhum dia do mês";
    if (diasFeitos >= 28) freqDiario = "Sempre - Fez todos os dias do mês";
    else if (diasFeitos >= 20) freqDiario = "Frequentemente - fez mais de 4 vezes por semana";
    else if (diasFeitos >= 12) freqDiario = "Às vezes - fez pelo menos três vezes por semana";
    else if (diasFeitos > 0) freqDiario = "Raramente - Fez menos de duas vezes por semana";

    let countEd = 0; let countCrm = 0; let countRaio = 0; 
    let countAulaRegular = 0; let countAulaMinistrada = 0; 
    let diasVoluntariado = 0; let diasPraticasPsicologia = 0;
    
    // Novos contadores de Missões (Tarefas Pessoais)
    let countLimpeza = 0; let countGN = 0; let countEstudos = 0; let countBastiao = 0;

    cicloEntries.forEach(entry => {
      const fv = entry.fvDaily || {};
      if (fv.aulaEdPresenca === 'Sim') countEd++;
      if (fv.crmPresenca === 'Sim') countCrm++;
      if (fv.reuniaoRaioPresenca === 'Sim') countRaio++;
      if (fv.aulaRegularPresenca === 'Sim') countAulaRegular++;
      if (fv.aulaMinistradaPresenca === 'Sim') countAulaMinistrada++;
      if (fv.horasVoluntariado && fv.horasVoluntariado.trim() !== '') diasVoluntariado++;
      
      // Conta DIAS em que fez pelo menos uma prática, não a soma de tudo!
      if (fv.praticas && Object.values(fv.praticas).some(v => v === true)) {
        diasPraticasPsicologia++;
      }

      // A MÁGICA: O app lê o nome das tarefas que você marcou como concluídas nos dias
      if (entry.tasksSnapshot) {
        entry.tasksSnapshot.forEach(task => {
           if (task.completed) {
             const tName = task.name.toLowerCase();
             if (tName.includes('limpeza') || tName.includes('faxina') || tName.includes('mutirão')) countLimpeza++;
             if (tName.includes('gn') || tName.includes('guarda noturna')) countGN++;
             if (tName.includes('estudar') || tName.includes('matéria') || tName.includes('curso') || tName.includes('resumo')) countEstudos++;
             if (tName.includes('bastião') || tName.includes('bastiao') || tName.includes('leitura do ciclo')) countBastiao++;
           }
        });
      }
    });

    // 2. TRADUÇÃO DOS DADOS PARA O FORMATO DO RELATÓRIO
    let freqVoluntariadoCalc = "Não participou";
    if (diasVoluntariado >= 12) freqVoluntariadoCalc = "Mais de três vezes por semana";
    else if (diasVoluntariado >= 5) freqVoluntariadoCalc = "Duas a três vezes por semana";
    else if (diasVoluntariado >= 1) freqVoluntariadoCalc = "Uma vez por semana";

    let praticasPsicologiaCalc = "Nunca - Não fez nenhum dia do mês";
    if (diasPraticasPsicologia >= 28) praticasPsicologiaCalc = "Sempre - Fez todos os dias do mês";
    else if (diasPraticasPsicologia >= 20) praticasPsicologiaCalc = "Frequentemente - fez mais de 4 vezes por semana";
    else if (diasPraticasPsicologia >= 12) praticasPsicologiaCalc = "Às vezes - fez pelo menos três vezes por semana";
    else if (diasPraticasPsicologia > 0) praticasPsicologiaCalc = "Raramente - Fez menos de duas vezes por semana";

    const estudandoMateriasCalc = countEstudos > 0 ? `Sim (${countEstudos} sessões de estudo na Missão)` : 'Não registrado';
    const fezGnCalc = countGN > 0 ? `Sim (${countGN}x)` : 'Não';
    const limpezaCalc = countLimpeza > 0 ? `${countLimpeza}` : 'Nenhuma';
    const bastioesCalc = monthlyReport.bastioesLidos || (countBastiao > 0 ? `${countBastiao} sessões de leitura` : 'Não registrado');

    const livroAtual = books.filter(b => b.totalPages > 0 && b.currentPage < b.totalPages)[0];
    const nomeLivro = livroAtual ? `${livroAtual.title} (${livroAtual.author})` : 'Nenhum no momento';

    // 3. MONTAGEM DO TEXTO FINAL (Puxando de stats.hAs, stats.hVol, stats.hMin)
    const relatorio = `RELATÓRIO MENSAL - ${mesAno.toUpperCase()}

[IDENTIFICAÇÃO]
Nome: ${getUserFirstName()}
Unidade: ${fvUnidade || 'Não informada'}
Condição: ${fvCondicao || 'Não informada'}

[ACOMPANHAMENTO INTERNO]
Tem feito o diário? ${freqDiario} (App registrou ${diasFeitos} dias)
Para quem envia CD? ${fvMasterName || 'Não informado'}
Data do último encontro: ${fvLastMeetingDate ? new Date(fvLastMeetingDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado'}
Data da última entrega da CD: ${fvLastCartaDate ? new Date(fvLastCartaDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado'}
Assistiu aula de ED esse mês? ${countEd > 0 ? `Sim (${countEd}x)` : 'Não'}

[IDEOLÓGICO]
Participou da CRM Mensal? ${countCrm > 0 ? 'Sim' : 'Não'}
Reuniões por Raio? ${countRaio} reuniões registradas
Outras CRM? ${monthlyReport.outrasCrm || '-'}
Quantos bastiões leu esse mês? ${bastioesCalc}

[ESCOLÁSTICA]
Dias de aula do Curso de Filosofia assistidos: ${countAulaRegular} aulas
Práticas de psicologia (Tratak/Câmara/Atenção): ${praticasPsicologiaCalc} (${totalPraticasPsicologia} práticas feitas)
Horas Aula Assistidas (Calculadas): ${stats.hAs}
Estudando para matérias? ${estudandoMateriasCalc}
Livro filosófico lendo: ${monthlyReport.livroFilosofico || nomeLivro}

[VOLUNTARIADO]
Frequência voluntariado (Calculada): ${freqVoluntariadoCalc} (${diasVoluntariado} dias com serviço registrado)
Fez GN esse mês? ${fezGnCalc}
Horas Voluntariado Totais: ${stats.hVol}
Ministrou aulas de filosofia? ${countAulaMinistrada > 0 ? `Sim (${countAulaMinistrada} aulas)` : 'Não'}
Horas Aula Ministradas (Calculadas): ${stats.hMin}
Escalas de limpeza: ${limpezaCalc}
Envolvimento propaganda: ${(monthlyReport.propaganda || []).join(', ') || '-'}

[FINANCEIRO]
Contribuição mensal: ${monthlyReport.contribuicao || '-'}
Doação para a escola: ${monthlyReport.doacao || '-'}

[SECRETARIAS]
Secretaria / Área: ${monthlyReport.secretariaAtuacao || '-'}
Trabalho junto/reunião: ${monthlyReport.secretariaReuniao || '-'}
Membros participando / Destaques: ${monthlyReport.secretariaMembros || '-'}

[ANÁLISE E REFLEXÃO]
Pontos positivos/crescimento:
${monthlyReport.pontosPositivos || '-'}

Desafio que está percebendo para crescer:
${monthlyReport.desafioCrescimento || '-'}
`;

    navigator.clipboard.writeText(relatorio).then(() => {
      alert("✅ Relatório gerado com sucesso! A IA cruzou seus dados do diário e suas tarefas do mês. O texto já está copiado na sua Área de Transferência.");
    }).catch(err => {
      console.error('Falha ao copiar:', err);
      alert("Erro ao copiar. Seu navegador pode ter bloqueado a ação.");
    });
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
    // Fricção cognitiva: obriga a digitar para evitar exclusão acidental
    const dataFormatada = dateKey.split('-').reverse().join('/');
    const confirmacao = window.prompt(`A exclusão é permanente e quebrará sua corrente de constância (Streak) se for um dia passado.\n\nPara excluir o registro do dia ${dataFormatada}, digite a palavra exata: APAGAR`);
    
    if (confirmacao !== 'APAGAR') {
      if (confirmacao !== null) {
        alert('❌ Exclusão cancelada. A palavra foi digitada incorretamente.');
      }
      return; // Aborta a exclusão
    }

    try {
      await deleteDoc(doc(db, 'entries', `${user.uid}_${dateKey}`));
      setEntries(entries.filter(e => e.date !== dateKey));
      alert('🗑️ Registro excluído com sucesso.');
    } catch (error) { 
      alert('Erro ao excluir a entrada. Verifique sua conexão.'); 
    }
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
  const getFvMonthlyStats = () => {
    const stats = {
      horasVoluntariadoMin: 0,
      horasAssistidaMin: 0,
      horasMinistradaMin: 0,
      diasPraticas: 0,
      countAulaRegular: 0,
      countEd: 0,
      countCrm: 0,
      countRaio: 0,
      countLimpeza: 0,
      countGN: 0
    };

    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    const cicloEntries = entries.filter(e => new Date(e.date + 'T12:00:00') >= trintaDiasAtras);

    cicloEntries.forEach(entry => {
      const fv = entry.fvDaily || {};

      // 1. Somatória de Horas
      if (fv.horasVoluntariado) {
        const [h, m] = fv.horasVoluntariado.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) stats.horasVoluntariadoMin += (h * 60) + m;
      }
      if (fv.horasAulaAssistida) {
        const [h, m] = fv.horasAulaAssistida.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) stats.horasAssistidaMin += (h * 60) + m;
      }
      if (fv.horasAulaMinistrada) {
        const [h, m] = fv.horasAulaMinistrada.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) stats.horasMinistradaMin += (h * 60) + m;
      }

      // 2. Frequência de Práticas
      if (fv.praticas && Object.values(fv.praticas).some(v => v === true)) {
        stats.diasPraticas++;
      }

      // 3. Contagem de Presenças (O que faltava para os Cards)
      if (fv.aulaRegularPresenca === 'Sim') stats.countAulaRegular++;
      if (fv.aulaEdPresenca === 'Sim') stats.countEd++;
      if (fv.crmPresenca === 'Sim') stats.countCrm++;
      if (fv.reuniaoRaioPresenca === 'Sim') stats.countRaio++;

      // 4. Contagem de Missões (GN e Limpeza)
      if (entry.tasksSnapshot) {
        entry.tasksSnapshot.forEach(task => {
           if (task.completed) {
             const tName = task.name.toLowerCase();
             if (tName.includes('limpeza') || tName.includes('faxina') || tName.includes('mutirão')) stats.countLimpeza++;
             if (tName.includes('gn') || tName.includes('guarda noturna')) stats.countGN++;
           }
        });
      }
    });

    // A RÉGUA DE TRADUÇÃO DE FREQUÊNCIA
    let freqPraticas = "Nunca";
    if (stats.diasPraticas >= 28) freqPraticas = "Sempre";
    else if (stats.diasPraticas >= 20) freqPraticas = "Frequentemente";
    else if (stats.diasPraticas >= 12) freqPraticas = "Às vezes";
    else if (stats.diasPraticas > 0) freqPraticas = "Raramente";

    const fmt = (m) => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
    
    // RETORNO DE TODOS OS DADOS JUNTOS
    return { ...stats, hVol: fmt(stats.horasVoluntariadoMin), hAs: fmt(stats.horasAssistidaMin), hMin: fmt(stats.horasMinistradaMin), freqPraticas };
  };

  // --- TRADUTOR DO BADGE DE PRÁTICAS ---
  const getPraticasBadgeInfo = (dias) => {
    if (dias >= 28) return { label: 'Sempre', color: '#FFD700', icon: Sun };
    if (dias >= 20) return { label: 'Frequente', color: '#ff9800', icon: Flame };
    if (dias >= 12) return { label: 'Às vezes', color: '#4caf50', icon: Target };
    if (dias > 0) return { label: 'Raramente', color: '#e74c3c', icon: Sparkles };
    return { label: 'Nunca', color: isDark ? '#555' : '#999', icon: Moon };
  };

  // --- PINCEL MÁGICO UNIVERSAL (Acessível por todas as abas) ---
  const getBlockStyle = (status, isOpen, activeBorder) => {
    const corPadrao = activeBorder || (isDark ? '#FFD700' : '#996515');
    const corConcluido = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const corAtrasado = '#e74c3c'; // Vermelho Urgência

    let border = `2px solid ${corPadrao}`;
    let filter = 'none';
    let opacity = 1;

    if (status === 'full' && !isOpen) {
      border = `1px solid ${corConcluido}`;
      filter = 'grayscale(100%)';
      opacity = 0.45;
    } else if (status === 'partial' && !isOpen) {
      border = `2px dashed ${corPadrao}`;
      opacity = 0.9;
    } else if (status === 'overdue' && !isOpen) {
      border = `2px dashed ${corAtrasado}`;
      opacity = 1;
    }

    return {
      background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white',
      borderRadius: '16px', border, overflow: 'hidden', transition: 'all 0.4s ease',
      filter, opacity, boxShadow: (status === 'full' && !isOpen) ? 'none' : (status === 'overdue' && !isOpen ? '0 0 15px rgba(231, 76, 60, 0.3)' : '0 4px 12px rgba(0,0,0,0.1)')
    };
  };

  const getHeaderStyle = (status, isOpen) => {
    let bg = isOpen ? 'transparent' : (isDark ? 'rgba(0,0,0,0.2)' : '#fdfbf7');
    if (status === 'full' && !isOpen) bg = 'transparent';
    if (status === 'partial' && !isOpen) bg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
    if (status === 'overdue' && !isOpen) bg = isDark ? 'rgba(231, 76, 60, 0.1)' : 'rgba(231, 76, 60, 0.05)';
    
    return {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', cursor: 'pointer', 
      background: bg
    };
  };

  const renderTitle = (text, status, isOpen, icon) => {
    let titleColor = isDark ? '#f0e6d2' : '#2c1810';
    if (status === 'overdue') titleColor = '#e74c3c';
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {icon}
        <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', color: titleColor, fontFamily: "'Cinzel', serif", textDecoration: status === 'full' && !isOpen ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {text}
          {status === 'partial' && !isOpen && <span style={{fontSize: '0.8rem', opacity: 0.8, fontStyle: 'italic', fontFamily: 'Georgia, serif'}}>(Em Andamento)</span>}
          {status === 'overdue' && <span style={{fontSize: '0.8rem', color: '#e74c3c', fontStyle: 'italic', fontFamily: 'Georgia, serif'}}>(Atrasada!)</span>}
        </h2>
      </div>
    );
  };

  // -------------------------------------------------------------

  

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

  // --- A ANTE-SALA DE ESPERA (GUARDIÃO DA PORTA) ---
  if (user && fvAccessStatus !== 'approved') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)', fontFamily: 'Georgia, serif', color: isDark ? '#f0e6d2' : '#2c1810' }}>
        <header style={{ padding: '1.5rem 2rem', background: isDark ? 'rgba(26, 26, 46, 0.9)' : 'rgba(255, 255, 255, 0.5)', borderBottom: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Shield size={32} color={isDark ? '#d4af37' : '#8b7355'} />
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif" }}>Acesso Restrito</h1>
          </div>
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: 'transparent', border: `1px solid ${isDark ? '#d4af37' : '#8b7355'}`, color: isDark ? '#d4af37' : '#8b7355', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={16} /> Sair
          </button>
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(0,0,0,0.4)' : 'white', padding: '2.5rem 2rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
            
            {fvAccessStatus === 'pending' ? (
              <>
                <Clock size={56} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1.5rem' }} />
                <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", fontSize: '1.6rem' }}>Em Análise</h2>
                <p style={{ lineHeight: '1.6', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem' }}>
                  Sua solicitação foi enviada. O instrutor responsável verificará seus dados e liberará o acesso à plataforma em breve.
                </p>
                <div style={{ padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.1)', borderRadius: '8px', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Verifique novamente mais tarde.
                </div>
              </>
            ) : (
              <>
                <Lock size={56} color={isDark ? '#d4af37' : '#8b7355'} style={{ margin: '0 auto 1.5rem' }} />
                <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", fontSize: '1.6rem' }}>Identifique-se</h2>
                <p style={{ lineHeight: '1.6', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem' }}>
                  Esta é uma ferramenta de uso interno. Para solicitar a liberação do seu perfil, preencha os dados abaixo.
                </p>

                <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>Nome Completo</label>
                  <input type="text" value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="Seu nome..." style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                </div>

                <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>Unidade (Sede/Filial)</label>
                  <input type="text" value={requestUnit} onChange={(e) => setRequestUnit(e.target.value)} placeholder="Ex: Sede Nacional..." style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                </div>

                <button onClick={handleRequestAccess} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                  Solicitar Acesso
                </button>

                           </>
            )}

          </div>
        </main>
      </div>
    );
  } 

  // --- VARIÁVEIS GLOBAIS DE GAMIFICAÇÃO ---
  const statsMenu = getFvMonthlyStats();
  const todayKey2 = getTodayKey();
  const todayEntry = entries.find(e => e.date === todayKey2);
  const todayPraticas = todayEntry?.fvDaily?.praticas || {};
  const praticasHojeCount = Object.values(todayPraticas).filter(v => v === true).length;
  const totalPraticasCount = fvConfig?.praticas?.length || 4;
  const pb = getPraticasBadgeInfo(statsMenu.diasPraticas);
  const PraticaIcon = pb.icon;
  const todayKeyBadge = getTodayKey();
  const todayEntryBadge = entries.find(e => e.date === todayKeyBadge);
  const praticasDeHoje = todayEntryBadge?.fvDaily?.praticas
    ? Object.values(todayEntryBadge.fvDaily.praticas).filter(v => v === true).length
    : 0;
  const totalPraticasConfig = (fvConfig?.praticas?.length || 4) + 4;
  const todayEntryBadge = entries.find(e => e.date === getTodayKey());
  const todayGdveStatus = todayEntryBadge?.fvDaily?.gdveTasksStatus || {};
  const missoesCompletas = fvGdveTasks.filter(t => t.isCycle ? fvGdveCycleStatus[t.id] : (todayGdveStatus[t.id] >= t.target)).length;

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
            // VERSÃO CELULAR (Badges Interativos + Menu)
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              
              <div onClick={() => setShowStreakModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.5rem', background: streak > 0 ? (isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'), border: `1px solid ${streak > 0 ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? '#555' : '#ccc')}`, borderRadius: '12px', color: streak > 0 ? (isDark ? '#ffb74d' : '#e65100') : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                <StreakIcon size={14} fill={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : 'none'} /> {streak}
              </div>

              <div onClick={() => setShowPracticesModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.5rem', background: isDark ? 'rgba(0,0,0,0.3)' : '#fdfbf7', border: `1px solid ${pb.color}`, borderRadius: '12px', color: pb.color, fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
                <PraticaIcon size={14} /> <span>{pb.label}</span>
              </div>

              {fvUnlocked && fvGdveTasks.length > 0 && (
                <div onClick={() => setShowQuickFv(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.5rem', background: missoesCompletas === fvGdveTasks.length ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : '#fdfbf7'), border: `1px solid ${missoesCompletas === fvGdveTasks.length ? '#4caf50' : (isDark ? '#555' : '#ccc')}`, borderRadius: '12px', color: missoesCompletas === fvGdveTasks.length ? '#4caf50' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <Shield size={14} /> <span>{missoesCompletas}</span>
                </div>
              )}
              
              <button onClick={() => setIsMobileMenuOpen(true)} style={{ padding: '0.3rem', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '0.2rem' }}>
                <Menu size={28} color={isDark ? '#d4af37' : '#6b4423'} />
              </button>
            </div>
          ) : (
            // VERSÃO COMPUTADOR (Badges Interativos + Menu Agrupado)
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              
              <div onClick={() => setShowStreakModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: streak > 0 ? (isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'), border: `1px solid ${streak > 0 ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? '#555' : '#ccc')}`, borderRadius: '20px', color: streak > 0 ? (isDark ? '#ffb74d' : '#e65100') : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontFamily: 'Georgia, serif', fontSize: '0.85rem', cursor: 'pointer', boxShadow: streak > 0 && isDark ? '0 0 10px rgba(255, 152, 0, 0.2)' : 'none' }}>
                <StreakIcon size={16} fill={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : 'none'} />
                <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
              </div>

              <div onClick={() => setShowPracticesModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: isDark ? 'rgba(0,0,0,0.3)' : '#fdfbf7', border: `1px solid ${pb.color}`, borderRadius: '20px', color: pb.color, fontWeight: 'bold', fontFamily: 'Georgia, serif', fontSize: '0.85rem', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform='scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform='scale(1)'}>
                <PraticaIcon size={16} /> <span>{pb.label}</span>
              </div>

              {fvUnlocked && fvGdveTasks.length > 0 && (
                <div onClick={() => setShowQuickFv(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: missoesCompletas === fvGdveTasks.length ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : '#fdfbf7'), border: `1px solid ${missoesCompletas === fvGdveTasks.length ? '#4caf50' : (isDark ? '#555' : '#ccc')}`, borderRadius: '20px', color: missoesCompletas === fvGdveTasks.length ? '#4caf50' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontFamily: 'Georgia, serif', fontSize: '0.85rem', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform='scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform='scale(1)'}>
                  <Shield size={16} /> <span>{missoesCompletas}/{fvGdveTasks.length}</span>
                </div>
              )}

              {/* BOTÃO MENU DROPDOWN */}
              <div style={{ position: 'relative', marginLeft: '0.5rem' }} onMouseLeave={() => setShowDiaryMenu(false)}>
                <button onMouseEnter={() => setShowDiaryMenu(true)} onClick={() => setShowDiaryMenu(!showDiaryMenu)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Menu size={16} /> Menu <ChevronDown size={14} />
                </button>
                {showDiaryMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: '0.5rem', zIndex: 1000 }}>
                    <div className="animate-fadeIn" style={{ width: '200px', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'white', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                      {[
                        { id: 'today', icon: <BookOpen size={16}/>, label: 'Hoje' },
                        { id: 'history', icon: <Calendar size={16}/>, label: 'Histórico' },
                        { id: 'leituras', icon: <Library size={16}/>, label: 'Estudos' },
                        { id: 'gdve', icon: <Shield size={16}/>, label: 'Discipulado', fvOnly: true },
                        { id: 'analytics', icon: <TrendingUp size={16}/>, label: 'Métricas' },
                        { id: 'notifications', icon: <Bell size={16}/>, label: 'Guardião' }
                      ].map(btn => {
                        if (btn.fvOnly && !fvUnlocked) return null;
                        const isActive = view === btn.id;
                        return (
                          <button key={btn.id} onClick={() => { setView(btn.id); setShowDiaryMenu(false); }} style={{ padding: '0.8rem', background: isActive ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', borderBottom: '1px solid rgba(139, 115, 85, 0.1)', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: isActive ? 'bold' : 'normal' }}>
                            {btn.icon} {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* BOTÃO OPÇÕES DROPDOWN */}
              <div style={{ position: 'relative' }} onMouseLeave={() => setShowProfileMenu(false)}>
                <button onMouseEnter={() => setShowProfileMenu(true)} onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ padding: '0.5rem', background: 'transparent', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer' }}>
                  <Settings size={18} color={isDark ? '#d4af37' : '#6b4423'} />
                </button>
                {showProfileMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: '0.5rem', zIndex: 1000 }}>
                    <div className="animate-fadeIn" style={{ width: '180px', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'white', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                      <button onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); }} style={{ padding: '0.8rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(139, 115, 85, 0.1)', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings size={16}/> Configurações</button>
                      <button onClick={() => { toggleTheme(); setShowProfileMenu(false); }} style={{ padding: '0.8rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(139, 115, 85, 0.1)', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{isDark ? <Sun size={16}/> : <Moon size={16}/>} {isDark ? 'Tema Claro' : 'Tema Escuro'}</button>
                      <button onClick={handleLogout} style={{ padding: '0.8rem', background: 'rgba(231, 76, 60, 0.1)', border: 'none', color: '#e74c3c', textAlign: 'left', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><LogOut size={16}/> Sair</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* MENU SUSPENSO MOBILE (GAVETA) */}
      {isMobileMenuOpen && (
        <div className="animate-fadeIn" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, height: '100dvh', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(240, 230, 210, 0.98)', zIndex: 10001, backdropFilter: 'blur(10px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '1.5rem', paddingBottom: '120px', minHeight: '101%', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2rem', borderBottom: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.5rem' }}>Menu</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={32} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
              {[
                { id: 'today', icon: <BookOpen size={22}/>, label: 'Hoje' },
                { id: 'history', icon: <Calendar size={22}/>, label: 'Histórico' },
                { id: 'leituras', icon: <Library size={22}/>, label: 'Estudos' },
                { id: 'gdve', icon: <Shield size={22}/>, label: 'Discipulado', fvOnly: true },
                { id: 'analytics', icon: <TrendingUp size={22}/>, label: 'Métricas' },
                { id: 'notifications', icon: <Bell size={22}/>, label: 'Guardião' }
              ].map((item) => {
                if (item.fvOnly && !fvUnlocked) return null;
                const isActive = view === item.id;
                return (
                  <button 
                    key={item.id}
                    onClick={() => { setView(item.id); setIsMobileMenuOpen(false); }} 
                    style={{ width: '100%', padding: '1rem', textAlign: 'left', background: isActive ? (isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)') : 'transparent', color: isActive ? (isDark ? '#FFD700' : '#6b4423') : (isDark ? '#f0e6d2' : '#2c1810'), border: `1px solid ${isActive ? (isDark ? '#d4af37' : '#6b4423') : 'transparent'}`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: isActive ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  >
                    {item.icon} {item.label}
                  </button>
                );
              })}

              <button onClick={() => { setIsMobileMenuOpen(false); setActivePracticeId('tratack'); setPracticePhase('intro'); setIsPracticeActive(true); }} style={{ width: '100%', padding: '1rem', textAlign: 'left', background: 'transparent', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid transparent', borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Target size={22} color={isDark ? '#f0e6d2' : '#2c1810'} /> Fazer Tratak
              </button>
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
        
        {/* VIEW: DIÁRIO (FUNDIDA COM FV) */}
        {view === 'today' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* CABEÇALHO DO DIA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', background: selectedDate !== getTodayKey() ? (isDark ? 'rgba(231, 76, 60, 0.15)' : 'rgba(231, 76, 60, 0.1)') : (isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)'), borderRadius: '12px', border: `2px solid ${selectedDate !== getTodayKey() ? '#e74c3c' : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Calendar size={28} color={isDark ? '#d4af37' : '#6b4423'} />
                <div>
                  <h2 style={{ margin: 0, fontWeight: 'bold', color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif", fontSize: '1.4rem' }}>
                    {selectedDate === getTodayKey() ? "Hoje" : "Registro Histórico"}
                  </h2>
                  <p style={{ margin: '0.2rem 0 0 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem' }}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, borderRadius: '8px', padding: '0.2rem' }}>
                      <button 
                        onClick={() => {
                          const d = new Date(selectedDate + 'T12:00:00');
                          d.setDate(d.getDate() - 1);
                          handleDateChange(d.toISOString().split('T')[0]);
                        }}
                        style={{ background: 'transparent', border: 'none', color: isDark ? '#d4af37' : '#2c1810', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Dia Anterior"
                      >
                        <ChevronLeft size={20} />
                      </button>

                      <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => handleDateChange(e.target.value)} 
                        max={getTodayKey()} 
                        style={{ background: 'transparent', color: isDark ? '#f0e6d2' : '#2c1810', border: 'none', padding: '0.5rem', fontSize: '1rem', fontFamily: 'Georgia, serif', outline: 'none', cursor: 'pointer' }}
                      />

                      <button 
                        onClick={() => {
                          if (selectedDate >= getTodayKey()) return; 
                          const d = new Date(selectedDate + 'T12:00:00');
                          d.setDate(d.getDate() + 1);
                          handleDateChange(d.toISOString().split('T')[0]);
                        }}
                        style={{ background: 'transparent', border: 'none', color: selectedDate >= getTodayKey() ? (isDark ? '#555' : '#ccc') : (isDark ? '#d4af37' : '#2c1810'), cursor: selectedDate >= getTodayKey() ? 'not-allowed' : 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Próximo Dia"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    {selectedDate !== getTodayKey() && (
                      <button onClick={() => handleDateChange(getTodayKey())} style={{ padding: '0.6rem 1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Voltar a Hoje</button>
                    )}
                  </div>
            </div>

            {/* CITAÇÃO */}
            {dailyQuote && (
              <div style={{ padding: '2rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.6)', borderRadius: '12px', borderLeft: `4px solid ${isDark ? '#d4af37' : '#8b7355'}`, fontStyle: 'italic' }}>
                <p style={{ fontSize: '1.2rem', color: isDark ? '#f0e6d2' : '#2c1810', margin: '0 0 1rem 0', lineHeight: '1.6' }}>"{dailyQuote.text}"</p>
                <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', margin: 0, textAlign: 'right', fontWeight: 'bold' }}>— {dailyQuote.author}</p>
              </div>
            )}

            {/* PRÁTICAS DE HOJE (Tarefas extras) */}
            {getTasksForToday().length > 0 && (
              <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '1.5rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: isDark ? '#f0e6d2' : '#2c1810' }}>✓ Desafios Diários</h3>
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

            {/* ================= AS 5 GAVETAS DO DIÁRIO ================= */}
            {(() => {
              // 1. O Cérebro: Lê o que já está efetivamente SALVO no banco de dados
              const savedEntryForToday = entries.find(e => e.date === selectedDate) || {};
              const savedFvDaily = savedEntryForToday.fvDaily || {};

              // Juiz do Prólogo: Exige o preenchimento do compromisso prático para "fechar" visualmente a gaveta.
              const prologoStatus = morningDone ? (dailyIntention.trim().length > 0 ? 'full' : 'partial') : 'empty';
              const epilogoStatus = eveningDone ? 'full' : 'empty';

              // Juiz da Forja (Práticas)
              const totalPraticas = (fvConfig?.praticas?.length || 4) + 4; // Práticas base + 4 do Templo
              const praticasFeitas = savedFvDaily.praticas ? Object.values(savedFvDaily.praticas).filter(v => v === true).length : 0;
              const forjaStatus = praticasFeitas === 0 ? 'empty' : (praticasFeitas === totalPraticas ? 'full' : 'partial');

              // Juiz da Escalada (Reflexões)
              const fvCartaItems = fvConfig?.itensCarta || [];
              let itensEscaladaFeitos = 0;
              fvCartaItems.forEach(item => {
                if (item.id === 'item2') {
                   const subKeys = ['instintos', 'idade', 'enfermidade', 'animo', 'humor', 'ideias', 'sentimentos', 'ambiente'];
                   const hasSub = subKeys.some(k => (savedFvDaily[`item2_${k}`] || '').trim().length > 0) || (savedFvDaily.item2 || '').trim().length > 0;
                   if (hasSub) itensEscaladaFeitos++;
                } else {
                   if ((savedFvDaily[item.id] || '').trim().length > 0) itensEscaladaFeitos++;
                }
              });
              const escaladaStatus = itensEscaladaFeitos === 0 ? 'empty' : (itensEscaladaFeitos === fvCartaItems.length ? 'full' : 'partial');

              const getHeaderStyle = (status, isOpen) => ({
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', cursor: 'pointer', 
                background: isOpen ? 'transparent' : (status === 'full' ? 'transparent' : (status === 'partial' ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : (isDark ? 'rgba(0,0,0,0.2)' : '#fdfbf7')))
              });

              // Montador de Títulos Inteligentes
              const renderTitle = (text, status, isOpen, icon) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {icon}
                  <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif", textDecoration: status === 'full' && !isOpen ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {text}
                    {status === 'partial' && !isOpen && <span style={{fontSize: '0.8rem', opacity: 0.8, fontStyle: 'italic', fontFamily: 'Georgia, serif'}}>(Em Andamento)</span>}
                  </h2>
                </div>
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* BLOCO 1: PRÓLOGO MATINAL */}
                  <div style={getBlockStyle(prologoStatus, isPrologoOpen, isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}>
                    <div onClick={() => setIsPrologoOpen(!isPrologoOpen)} style={getHeaderStyle(prologoStatus, isPrologoOpen)}>
                      {renderTitle('Prólogo Matinal', prologoStatus, isPrologoOpen, <Sunrise size={28} color={isDark ? '#ffd966' : '#ff9800'} />)}
                      {isPrologoOpen ? <ChevronUp size={24} color={isDark ? '#f0e6d2' : '#2c1810'} /> : <ChevronDown size={24} color={isDark ? '#f0e6d2' : '#2c1810'} />}
                    </div>

                    {isPrologoOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                        {morningDone ? (
                          <div style={{ padding: '1.5rem', background: isDark ? 'rgba(76, 175, 80, 0.1)' : '#e8f5e9', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.3)' : '#4caf50'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={24} color={isDark ? '#81c784' : '#4caf50'} />
                                <h3 style={{ margin: 0, color: isDark ? '#81c784' : '#2e7d32' }}>Armadura Colocada!</h3>
                              </div>
                              <button onClick={() => setMorningDone(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#81c784' : '#2e7d32', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 'bold' }}><Edit size={16} /> Editar</button>
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
                                <input type="text" placeholder="Digite sua virtude..." value={customVirtue} onChange={(e) => setCustomVirtue(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                              ) : (
                                <select value={selectedVirtue} onChange={(e) => setSelectedVirtue(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                                  <option value="">Selecione uma virtude...</option>
                                  {virtues.map((v, idx) => <option key={idx} value={v.name}>{v.name}</option>)}
                                </select>
                              )}

                              {selectedVirtue && !showCustomVirtue && (
                                <div onClick={() => setIsTodayVirtueExpanded(!isTodayVirtueExpanded)} style={{ marginTop: '1rem', padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.5)', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, cursor: 'pointer' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: '0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>{selectedVirtue}</h4>
                                    {isTodayVirtueExpanded ? <ChevronUp size={20} color={isDark ? '#d4af37' : '#6b4423'} /> : <ChevronDown size={20} color={isDark ? '#d4af37' : '#6b4423'} />}
                                  </div>
                                  
                                  {/* A DESCRIÇÃO CURTA DE VOLTA AQUI */}
                                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: isDark ? '#c8b896' : '#6b5744', fontStyle: 'italic' }}>
                                    {virtues.find(v => v.name === selectedVirtue)?.shortDesc}
                                  </p>

                                  {isTodayVirtueExpanded && (
                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                                      <p style={{ fontSize: '0.95rem', color: isDark ? '#f0e6d2' : '#2c1810', marginBottom: '1rem', lineHeight: '1.6' }}>{virtues.find(v => v.name === selectedVirtue)?.description}</p>
                                      <h5 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#d4af37' : '#6b4423' }}>Práticas Sugeridas:</h5>
                                      <p style={{ fontSize: '0.9rem', color: isDark ? '#c8b896' : '#6b5744', margin: 0, whiteSpace: 'pre-line' }}>{virtues.find(v => v.name === selectedVirtue)?.practices}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>Meu compromisso prático para hoje:</label>
                              <textarea value={dailyIntention} onChange={(e) => setDailyIntention(e.target.value)} placeholder="Como e quando exatamente eu vou praticar isso hoje?" rows={3} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                            </div>

                            <button onClick={saveMorning} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              <CheckCircle size={20} /> Firmar Compromisso
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BLOCO 2: AS PRÁTICAS DO TEMPLO (MÓDULO FV) */}
                  {fvUnlocked && fvConfig && (
                    <div style={getBlockStyle(forjaStatus, isPraticasOpen, '#FFD700')}>
                      <div onClick={() => setIsPraticasOpen(!isPraticasOpen)} style={getHeaderStyle(forjaStatus, isPraticasOpen)}>
                        {renderTitle('Práticas (A Forja do Caráter)', forjaStatus, isPraticasOpen, <Award size={28} color="#FFD700" />)}
                        {isPraticasOpen ? <ChevronUp size={24} color={isDark ? '#FFD700' : '#996515'} /> : <ChevronDown size={24} color={isDark ? '#FFD700' : '#996515'} />}
                      </div>
                      
                      {isPraticasOpen && (
                        <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {fvConfig.praticas.map(prac => (
                              <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: fvDaily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'), border: `1px solid ${fvDaily.praticas?.[prac.key] ? '#4caf50' : (isDark ? 'rgba(212, 175, 55, 0.3)' : '#ccc')}`, borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                {fvDaily.praticas?.[prac.key] ? <CheckCircle size={20} color="#4caf50" /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${isDark ? '#b8a88a' : '#999'}` }}></div>}
                                <span style={{ color: fvDaily.praticas?.[prac.key] ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '1.05rem', fontWeight: fvDaily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid #FFD700', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>Templo Interior</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                              {[
                                { key: 'porta', label: '1. Porta' },
                                { key: 'patioAberto', label: '2. Pátio Aberto' },
                                { key: 'patioColunas', label: '3. Pátio de Colunas' },
                                { key: 'santuario', label: '4. Santuário' }
                              ].map(prac => (
                                <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.8rem', background: fvDaily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : 'transparent', border: `1px solid ${fvDaily.praticas?.[prac.key] ? '#4caf50' : (isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)')}`, borderRadius: '8px', transition: 'all 0.2s' }}>
                                  {fvDaily.praticas?.[prac.key] ? <CheckCircle size={18} color="#4caf50" /> : <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${isDark ? '#b8a88a' : '#999'}` }}></div>}
                                  <span style={{ color: fvDaily.praticas?.[prac.key] ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#c8b896' : '#6b5744'), fontSize: '1rem', fontWeight: fvDaily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <button onClick={saveFvPractices} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#FFD700' : '#996515', border: '2px solid #FFD700', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <Save size={20} /> Salvar Práticas Realizadas
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BLOCO 3: A ESCALADA (AS REFLEXÕES DO FV) */}
                  {fvUnlocked && fvConfig && (
                    <div style={getBlockStyle(escaladaStatus, isEscaladaOpen, '#FFD700')}>
                      <div onClick={() => setIsEscaladaOpen(!isEscaladaOpen)} style={getHeaderStyle(escaladaStatus, isEscaladaOpen)}>
                        {renderTitle('Degrau (A Escalada)', escaladaStatus, isEscaladaOpen, <Mountain size={28} color={isDark ? '#FFD700' : '#996515'} />)}
                        {isEscaladaOpen ? <ChevronUp size={24} color={isDark ? '#FFD700' : '#996515'} /> : <ChevronDown size={24} color={isDark ? '#FFD700' : '#996515'} />}
                      </div>

                      {isEscaladaOpen && (
                        <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                          <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic', marginBottom: '2rem', fontSize: '0.95rem' }}>Ao salvar, os itens preenchidos ficarão cinzas para descansar sua mente.</p>

                          {fvConfig.itensCarta.map(item => {
                            const isItem2 = item.id === 'item2';
                            const subKeys = ['instintos', 'idade', 'enfermidade', 'animo', 'humor', 'ideias', 'sentimentos', 'ambiente'];
                            const subLabels = ['Instintos (Conserv. / Procriação)', 'Idade', 'Enfermidade', 'Ânimo', 'Humor', 'Ideias', 'Sentimentos', 'Ambiente'];
                            
                            const isFilled = isItem2 
                              ? subKeys.some(k => (savedFvDaily[`item2_${k}`] || '').trim().length > 0)
                              : (savedFvDaily[item.id] || '').trim().length > 0;
                              
                            const actuallyExpanded = expandedCartaItems[item.id] !== undefined ? expandedCartaItems[item.id] : !isFilled;

                            const borderColor = isFilled ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : (isDark ? 'rgba(212, 175, 55, 0.5)' : '#996515');
                            const headerColor = isFilled ? (isDark ? '#777' : '#aaa') : (isDark ? '#FFD700' : '#996515');
                            const bgColor = isFilled ? (isDark ? 'rgba(0,0,0,0.1)' : '#f9f9f9') : (isDark ? 'rgba(212, 175, 55, 0.05)' : 'white');

                            return (
                              <div key={item.id} style={{ marginBottom: '1rem', background: bgColor, borderRadius: '8px', border: `1px solid ${borderColor}`, transition: 'all 0.3s ease', overflow: 'hidden' }}>
                                <div 
                                  onClick={() => setExpandedCartaItems(prev => ({ ...prev, [item.id]: !actuallyExpanded }))}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', cursor: 'pointer', background: isFilled ? 'transparent' : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,245,220,0.3)') }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {isFilled && <CheckCircle size={18} color={isDark ? '#555' : '#aaa'} />}
                                    <h4 style={{ margin: 0, fontWeight: 600, fontSize: '1.05rem', color: headerColor, fontFamily: "'Cinzel', serif", textTransform: 'uppercase', textDecoration: isFilled ? 'line-through' : 'none' }}>
                                      {item.label}
                                    </h4>
                                  </div>
                                  {actuallyExpanded ? <ChevronUp size={20} color={headerColor} /> : <ChevronDown size={20} color={headerColor} />}
                                </div>

                                {actuallyExpanded && (
                                  <div className="animate-fadeIn" style={{ padding: '0 1.2rem 1.2rem 1.2rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#888', marginBottom: '1rem', fontStyle: 'italic' }}>{item.desc}</p>
                                    
                                    {isItem2 ? (
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                        {subKeys.map((subK, i) => (
                                          <div key={subK}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: isDark ? '#d4af37' : '#996515', marginBottom: '0.4rem', fontWeight: 'bold' }}>{subLabels[i]}</label>
                                            <textarea 
                                              value={fvDaily[`item2_${subK}`] || ''} 
                                              onChange={(e) => handleFvDailyTextChange(`item2_${subK}`, e.target.value)} 
                                              placeholder="Análise..." 
                                              rows={2} 
                                              style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} 
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <textarea 
                                        value={fvDaily[item.id] || ''} 
                                        onChange={(e) => handleFvDailyTextChange(item.id, e.target.value)} 
                                        placeholder="Registro..." 
                                        rows={3} 
                                        style={{ width: '100%', padding: '1rem', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} 
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <button onClick={saveFvTexts} style={{ width: '100%', padding: '1rem', background: 'rgba(255, 215, 0, 0.1)', color: isDark ? '#FFD700' : '#996515', border: '1px solid #FFD700', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', marginTop: '1rem' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,215,0,0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)'}>
                            <Save size={20} /> Salvar Relatos da Escalada
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BLOCO 4: EPÍLOGO NOTURNO */}
                  <div style={getBlockStyle(epilogoStatus, isEpilogoOpen, isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}>
                    <div onClick={() => setIsEpilogoOpen(!isEpilogoOpen)} style={getHeaderStyle(epilogoStatus, isEpilogoOpen)}>
                      {renderTitle('Epílogo Noturno', epilogoStatus, isEpilogoOpen, <Sunset size={28} color={isDark ? '#b19cd9' : '#9c27b0'} />)}
                      {isEpilogoOpen ? <ChevronUp size={24} color={isDark ? '#f0e6d2' : '#2c1810'} /> : <ChevronDown size={24} color={isDark ? '#f0e6d2' : '#2c1810'} />}
                    </div>

                    {isEpilogoOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                        {eveningDone ? (
                          <div style={{ padding: '1.5rem', background: isDark ? 'rgba(76, 175, 80, 0.1)' : '#e8f5e9', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.3)' : '#4caf50'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={24} color={isDark ? '#81c784' : '#4caf50'} />
                                <h3 style={{ margin: 0, color: isDark ? '#81c784' : '#2e7d32' }}>Paz Conquistada!</h3>
                              </div>
                              <button onClick={() => setEveningDone(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#81c784' : '#2e7d32', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 'bold' }}><Edit size={16} /> Editar</button>
                            </div>
                            <p style={{ margin: 0, color: isDark ? '#c8e6c9' : '#1b5e20' }}>Exame noturno encerrado. Descanse com dignidade. 🌙</p>
                          
                          {/* EXIBE AS RESPOSTAS SE TIVER */}
                            {fvUnlocked && (savedEntryForToday.fvDaily?.aulaRegularPresenca || savedEntryForToday.fvDaily?.reuniaoRaioPresenca || savedEntryForToday.fvDaily?.aulaMinistradaPresenca) && (
                               <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.2)'}` }}>
                                 {savedEntryForToday.fvDaily?.aulaRegularPresenca && <p style={{ margin: '0.2rem 0', color: isDark ? '#a5d6a7' : '#2e7d32', fontSize: '0.9rem' }}><strong>Aula Regular:</strong> {savedEntryForToday.fvDaily.aulaRegularPresenca}</p>}
                                 {savedEntryForToday.fvDaily?.reuniaoRaioPresenca && <p style={{ margin: '0.2rem 0', color: isDark ? '#a5d6a7' : '#2e7d32', fontSize: '0.9rem' }}><strong>Reunião de Raio:</strong> {savedEntryForToday.fvDaily.reuniaoRaioPresenca}</p>}
                                 {savedEntryForToday.fvDaily?.aulaMinistradaPresenca && <p style={{ margin: '0.2rem 0', color: isDark ? '#a5d6a7' : '#2e7d32', fontSize: '0.9rem' }}><strong>Aula Ministrada:</strong> {savedEntryForToday.fvDaily.aulaMinistradaPresenca}</p>}
                               </div>
                            )}
                          
                          </div>
                        ) : (

                          
                          <div>
                            {/* GATILHO INTELIGENTE E BALANÇO DE HORAS UNIFICADO */}
                            {fvUnlocked && fvCalendar && (
                              (() => {
                                const todayDateObj = new Date(selectedDate + 'T12:00:00');
                                const dayOfWeek = String(todayDateObj.getDay());
                                const todayStr = selectedDate; 
                                
                                const showAulaRegular = fvCalendar.aulaRegularDia === dayOfWeek;
                                const showReuniaoRaio = fvCalendar.reuniaoRaioDia === dayOfWeek || fvCalendar.reunioesRaioDia === dayOfWeek; 
                                const showAulaMinistrada = (fvCalendar.aulaMinistradaDias || []).includes(dayOfWeek);
                                const showCrm = fvCalendar.dataCrm === todayStr;
                                const showEd = fvCalendar.dataAulaEd === todayStr;
                                
                                const temAulaHoje = showAulaRegular || showReuniaoRaio || showAulaMinistrada || showCrm || showEd;

                                return (
                                  <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(155, 89, 182, 0.05)' : '#fdf8ff', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.3)' : '#e1bee7'}`, marginBottom: '2rem' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#c39bd3' : '#8e44ad', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <Clock size={18} /> Balanço de Serviço e Atividades
                                    </h4>
                                    
                                    {/* Perguntas Dinâmicas de Aula (Só aparecem se for o dia certo) */}
                                    {temAulaHoje && (
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: `1px dashed ${isDark ? 'rgba(155, 89, 182, 0.3)' : '#e1bee7'}` }}>
                                        {showAulaRegular && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>Assistiu à Aula Regular?</label>
                                            <select value={fvDaily.aulaRegularPresenca || ''} onChange={(e) => handleFvDailyTextChange('aulaRegularPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, assisti</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                        {showReuniaoRaio && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>Participou da Reunião de Raio?</label>
                                            <select value={fvDaily.reuniaoRaioPresenca || ''} onChange={(e) => handleFvDailyTextChange('reuniaoRaioPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, participei</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                        {showAulaMinistrada && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>Ministrou sua Aula hoje?</label>
                                            <select value={fvDaily.aulaMinistradaPresenca || ''} onChange={(e) => handleFvDailyTextChange('aulaMinistradaPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, ministrei</option><option value="Não">Não</option>
                                            </select>
                                          </div>
                                        )}
                                        {showCrm && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: isDark ? '#c39bd3' : '#8e44ad', fontWeight: 'bold' }}>Esteve na CRM Mensal?</label>
                                            <select value={fvDaily.crmPresenca || ''} onChange={(e) => handleFvDailyTextChange('crmPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, estive</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                        {showEd && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#3498DB', fontWeight: 'bold' }}>Assistiu à Aula de ED?</label>
                                            <select value={fvDaily.aulaEdPresenca || ''} onChange={(e) => handleFvDailyTextChange('aulaEdPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, assisti</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Voluntariado Extra Livre (Sempre Visível) */}
                                    <div style={{ padding: '1rem', background: isDark ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.2)' : '#e1bee7'}` }}>
                                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>Serviço / Voluntariado Extra Hoje?</label>
                                      <p style={{ fontSize: '0.8rem', color: isDark ? '#b8a88a' : '#888', marginTop: '-0.3rem', marginBottom: '0.8rem', fontStyle: 'italic' }}>
                                        {temAulaHoje ? "As horas das aulas acima já são calculadas sozinhas. Informe aqui apenas horários avulsos (limpezas, manutenções, etc)." : "Informe aqui o tempo dedicado a serviços avulsos pela Escola hoje (limpeza, manutenções, secretaria, etc)."}
                                      </p>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input type="time" value={fvDaily.horasVoluntariado || ''} onChange={(e) => handleFvDailyTextChange('horasVoluntariado', e.target.value)} style={{ width: '120px', padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                                        {(fvDaily.horasVoluntariado && fvDaily.horasVoluntariado !== '') && (
                                           <span style={{ color: '#4caf50', fontSize: '0.8rem', fontWeight: 'bold' }}>✓ Registrado</span>
                                        )}
                                      </div>
                                    </div>

                                  </div>
                                );
                              })()
                            )}

                            <p style={{ marginBottom: '1.5rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic', fontSize: '1.05rem', borderLeft: `3px solid ${isDark ? '#b19cd9' : '#9c27b0'}`, paddingLeft: '1rem' }}>"Que ninguém durma sem antes examinar as ações do dia" — Versos de Ouro de Pitágoras</p>

                            <div style={{ marginBottom: '2rem' }}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>Reflexão Final:</label>
                              <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#888', marginBottom: '1rem' }}>Escreva livremente sobre as vitórias, derrotas e percepções de hoje antes de dormir.</p>
                              <textarea value={freeEpilogue} onChange={(e) => setFreeEpilogue(e.target.value)} placeholder="Ao olhar para o dia de hoje, percebo que..." rows={6} style={{ width: '100%', padding: '1rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '1.05rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', lineHeight: '1.6' }} />
                            </div>

                            <button onClick={saveEvening} style={{ width: '100%', padding: '1.2rem', background: isDark ? '#b19cd9' : '#9c27b0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                              <Moon size={20} /> Encerrar o Dia (Salvar)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}

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

        {/* VIEW: CENTRAL DE NOTIFICAÇÕES (O GUARDIÃO) */}
        {view === 'notifications' && (
          <div className="animate-fadeIn" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setView('home')} style={{ background: 'transparent', border: 'none', color: isDark ? '#d4af37' : '#8b7355', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <ArrowLeft size={24} />
              </button>
              <Bell size={28} color={isDark ? '#d4af37' : '#8b7355'} />
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>
                O Guardião (Notificações)
              </h2>
            </div>

            <p style={{ color: isDark ? '#b8a88a' : '#666', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>
              Configure seu assistente pessoal no WhatsApp para manter a Forja sempre acesa.
            </p>

            {/* SEÇÃO 1: CONEXÃO */}
            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : '#ccc'}`, marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: isDark ? '#d4af37' : '#2c3e50', fontSize: '1.1rem' }}>
                <Smartphone size={20} /> Conexão WhatsApp
              </h3>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>Seu número (com DDD):</label>
              <input 
                type="text" 
                placeholder="Ex: 62999999999"
                value={notifSettings.whatsappNumber}
                onChange={(e) => setNotifSettings({...notifSettings, whatsappNumber: e.target.value.replace(/\D/g, '')})}
                style={{ width: '100%', maxWidth: '300px', padding: '0.8rem', borderRadius: '8px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.4)' : '#fff', color: isDark ? '#fff' : '#000' }}
              />
            </div>

            {/* SEÇÃO 2: HORÁRIOS FIXOS */}
            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : '#ccc'}`, marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: isDark ? '#d4af37' : '#2c3e50', fontSize: '1.1rem' }}>
                <Clock size={20} /> Rotina Diária
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={notifSettings.alerts.dailyVirtue} onChange={(e) => setNotifSettings({...notifSettings, alerts: {...notifSettings.alerts, dailyVirtue: e.target.checked}})} style={{ accentColor: '#d4af37', width: '16px', height: '16px' }} />
                    Sorteio da Virtude (Manhã)
                  </div>
                  <input type="time" value={notifSettings.notifMorningTime} onChange={(e) => setNotifSettings({...notifSettings, notifMorningTime: e.target.value})} style={{ padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.4)' : '#fff', color: isDark ? '#fff' : '#000', width: 'fit-content' }} disabled={!notifSettings.alerts.dailyVirtue} />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={notifSettings.alerts.dailyEpilogue} onChange={(e) => setNotifSettings({...notifSettings, alerts: {...notifSettings.alerts, dailyEpilogue: e.target.checked}})} style={{ accentColor: '#d4af37', width: '16px', height: '16px' }} />
                    Lembrete do Epílogo (Noite)
                  </div>
                  <input type="time" value={notifSettings.notifNightTime} onChange={(e) => setNotifSettings({...notifSettings, notifNightTime: e.target.value})} style={{ padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.4)' : '#fff', color: isDark ? '#fff' : '#000', width: 'fit-content' }} disabled={!notifSettings.alerts.dailyEpilogue} />
                </label>
              </div>
            </div>

            {/* SEÇÃO 3: ALERTAS CONDICIONAIS */}
            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : '#ccc'}`, marginBottom: '2rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: isDark ? '#d4af37' : '#2c3e50', fontSize: '1.1rem' }}>
                <ShieldAlert size={20} /> Guardião de Disciplina
              </h3>
              <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666', marginBottom: '1rem' }}>O Guardião avisa quando você está deixando a inércia vencer (disparado às 19h).</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { id: 'pendingTasks', label: 'Avisar se houver Tarefas Agendadas pendentes hoje' },
                  { id: 'readingSlump', label: 'Avisar se eu ficar +3 dias sem avançar nas Leituras' },
                  { id: 'practiceSlump', label: 'Avisar se eu ficar +3 dias sem registrar Práticas' },
                  { id: 'diarySlump', label: 'Avisar se eu ficar +3 dias sem preencher o Diário' },
                  { id: 'gdveWarning', label: 'Avisar faltando 1 semana para a reunião do GDVE (se leitura pendente)' },
                  { id: 'randomVirtue', label: 'Sorteio Aleatório Diário (Lembrar da Virtude no meio do dia)' }
                ].map(alert => (
                  <label key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={notifSettings.alerts[alert.id]} 
                      onChange={(e) => setNotifSettings({...notifSettings, alerts: {...notifSettings.alerts, [alert.id]: e.target.checked}})} 
                      style={{ accentColor: '#d4af37', width: '18px', height: '18px', cursor: 'pointer' }} 
                    />
                    {alert.label}
                  </label>
                ))}
              </div>
            </div>

            {/* BOTÃO SALVAR INTELIGENTE */}
            <button 
              onClick={saveNotificationSettings}
              disabled={saveBtnStatus !== 'idle'}
              style={{ 
                width: '100%', padding: '1rem', 
                background: saveBtnStatus === 'success' ? '#27ae60' : (isDark ? '#d4af37' : '#6b4423'), 
                color: saveBtnStatus === 'success' ? 'white' : (isDark ? '#1a1a2e' : 'white'), 
                border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', 
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', 
                cursor: saveBtnStatus !== 'idle' ? 'default' : 'pointer', 
                boxShadow: saveBtnStatus === 'success' ? '0 4px 15px rgba(39, 174, 96, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.3s ease' 
              }}
            >
              {saveBtnStatus === 'saving' ? <Sparkles className="animate-spin" size={20} /> : (saveBtnStatus === 'success' ? <CheckCircle size={20} /> : <Save size={20} />)} 
              {saveBtnStatus === 'saving' ? 'Salvando...' : (saveBtnStatus === 'success' ? 'Guardião Atualizado!' : 'Salvar Configurações')}
            </button>
          </div>
        )}

        {/* VIEW: LEITURAS E ESTUDOS */}
        {view === 'leituras' && (
          <div className="animate-fadeIn">
            {/* DICA DINÂMICA DE LEITURA (EPL2R) */}
            {dailyStudyTip && (
              <div style={{ padding: '1.5rem 2rem', background: isDark ? 'rgba(52, 152, 219, 0.05)' : '#f0f7ff', borderRadius: '12px', borderLeft: `4px solid ${isDark ? '#3498db' : '#2980b9'}`, marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ background: isDark ? 'rgba(52, 152, 219, 0.1)' : '#e0f0ff', padding: '1rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={28} color={isDark ? '#3498db' : '#2980b9'} />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: isDark ? '#3498db' : '#2980b9', display: 'block', marginBottom: '0.4rem' }}>
                    Técnica Recomendada: {dailyStudyTip.phase}
                  </span>
                  <p style={{ margin: 0, fontSize: '1.1rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', fontStyle: 'italic' }}>
                    "{dailyStudyTip.text}"
                  </p>
                </div>
              </div>
            )}
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative' }}>
                      <label style={{ 
                        cursor: isAwaitingScan ? 'wait' : 'pointer', 
                        background: isAwaitingScan ? 'rgba(212,175,55,0.1)' : 'transparent', 
                        color: isDark ? '#b8a88a' : '#6b5744', 
                        border: `1px solid ${isAwaitingScan ? '#FFD700' : (isDark ? '#b8a88a' : '#6b5744')}`, 
                        padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s' 
                      }}>
                        {isAwaitingScan ? (
                          <><Sparkles className="animate-spin" size={16} color="#FFD700" /> Identificando...</>
                        ) : (
                          <><Search size={16} /> Escanear Estante</>
                        )}
                        <input type="file" accept="image/*" capture="environment" onChange={handleShelfScan} disabled={isAwaitingScan} style={{ display: 'none' }} />
                      </label>
                      
                      {/* NOTIFICAÇÃO FLUTUANTE (TOAST) */}
                      {scanNotification?.show && (
                        <div 
                          onClick={() => { setShowScannerModal(true); setScanNotification(prev => ({ ...prev, show: false })); }}
                          className="animate-bounce"
                          style={{ position: 'absolute', top: '-60px', left: 0, right: 0, background: '#4caf50', color: 'white', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 10, width: 'max-content', minWidth: '220px' }}
                        >
                          <Check size={16} /> {scanNotification.count} livros encontrados! Clique aqui.
                        </div>
                      )}

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
                  
                  {/* BARRA DE PESQUISA GOOGLE */}
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
                              if (editingBookId) {
                                // MODO COMPLETAR: Salva, move para Lidos e fecha a tela
                                const updated = books.map(b => {
                                  if (b.id === editingBookId) {
                                    return {
                                      ...b,
                                      title: res.title,
                                      author: res.author,
                                      totalPages: res.totalPages,
                                      currentPage: res.totalPages,
                                      thumbnail: res.thumbnail,
                                      category: res.category,
                                      status: 'lido',
                                      finishedDate: new Date().toISOString(),
                                      isPendingEnrichment: false
                                    };
                                  }
                                  return b;
                                });
                                saveBooksToDb(updated);
                                setShowAddBook(false);
                                setBookSearchResults([]);
                                setEditingBookId(null);
                              } else {
                                // MODO NOVO LIVRO: Só preenche o form
                                setNewBook({ title: res.title, author: res.author, currentPage: 0, totalPages: res.totalPages, thumbnail: res.thumbnail, category: res.category });
                                setBookSearchResults([]);
                              }
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

                  {/* FORMULÁRIO FINAL (Preenchido ou Manual) */}
                  {bookSearchResults.length === 0 && !isSearchingBooks && (
                    <>
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
                          <label style={{ fontSize: '0.8rem', color: '#888' }}>Link do PDF (Drive/Dropbox)</label>
                          <input type="text" value={newBook.link || ''} onChange={(e) => setNewBook({...newBook, link: e.target.value})} placeholder="https://..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                      </div>
                    </>
                  )}
                  
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
                        {(() => {
                          const tituloLimpo = bookRecommendation.title.toLowerCase();
                          
                          // A Lista de Exceções baseada na sua pesquisa real
                          const livrosSemAmazon = [
                            'ankor',
                            'cartas a délia',
                            'cartas a delia',
                            'magia, religião',
                            'me disseram que',
                            'a vida depois da morte',
                            'o que fazemos com o coração',
                            'mitos, ritos e símbolos',
                            'iniciação e pensamento simbólico',
                            'a natureza da nossa busca'
                          ];

                          // Se o título sugerido contiver algum fragmento da lista acima, ele é exceção
                          const naoTemNaAmazon = livrosSemAmazon.some(livro => tituloLimpo.includes(livro));

                          let buyLink = '';
                          let buttonText = '';
                          let bgButton = '';

                          if (naoTemNaAmazon) {
                            // Vai para o Google focado em buscar em sebos ou na própria editora
                            buyLink = `https://www.google.com/search?q=${encodeURIComponent('comprar livro ' + bookRecommendation.title + ' ' + bookRecommendation.author)}`;
                            buttonText = 'Buscar em Sebos ou Editora';
                            bgButton = '#3498DB'; // Azul para indicar que é uma busca externa
                          } else {
                            // Rota Ouro: Vai para a Amazon com o seu Link de Afiliado!
                            buyLink = `https://www.amazon.com.br/s?k=${encodeURIComponent('livro ' + bookRecommendation.title + ' ' + bookRecommendation.author)}&tag=${AMAZON_AFFILIATE_ID}`;
                            buttonText = 'Comprar na Amazon';
                            bgButton = '#FF9900'; // Laranja Amazon clássico
                          }

                          return (
                            <a 
                              href={buyLink}
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ padding: '0.8rem 1.5rem', background: bgButton, color: '#000', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: `0 4px 12px ${naoTemNaAmazon ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255,153,0,0.3)'}` }}
                            >
                              {buttonText}
                            </a>
                          );
                        })()}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button 
                            onClick={async () => {
                              // Cria o livro já marcando com 1 página para o sistema entender que está concluído enquanto o Oráculo busca o real
                              const newBook = { id: `book_${Date.now()}`, title: bookRecommendation.title, author: bookRecommendation.author, totalPages: 1, currentPage: 1, thumbnail: bookRecommendation.thumbnail, category: 'Filosofia', isPendingEnrichment: true, status: 'lido', finishedDate: new Date().toISOString() };
                              saveBooksToDb([newBook, ...books]);
                              
                              // Adiciona aos descartes para o Oráculo nunca mais sugerir ele
                              const novaLista = [...discardedSuggestions, bookRecommendation.title];
                              setDiscardedSuggestions(novaLista);
                              if (user) await setDoc(doc(db, 'userBooks', user.uid), { discardedSuggestions: novaLista }, { merge: true });

                              generateBookRecommendation();
                            }}
                            disabled={isGeneratingRecommendation} style={{ flex: 1, background: 'transparent', border: `1px solid ${isDark ? '#555' : '#ccc'}`, color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', padding: '0.4rem', transition: 'all 0.2s' }}>{isGeneratingRecommendation ? 'Gerando...' : 'Já Li (Adicionar à Estante)'}</button>
                          
                          <button 
                            onClick={async () => {
                              const novaLista = [...discardedSuggestions, bookRecommendation.title];
                              setDiscardedSuggestions(novaLista);
                              if (user) await setDoc(doc(db, 'userBooks', user.uid), { discardedSuggestions: novaLista }, { merge: true });
                              generateBookRecommendation();
                            }}
                            disabled={isGeneratingRecommendation} style={{ flex: 1, background: 'transparent', border: `1px solid ${isDark ? '#555' : '#ccc'}`, color: '#e74c3c', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', padding: '0.4rem', transition: 'all 0.2s' }}>{isGeneratingRecommendation ? 'Gerando...' : 'Descartar Sugestão'}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* A ESTANTE DE LIVROS E SEÇÃO COMPLETAR */}
              {/* BARRA DE PESQUISA NA ESTANTE */}
              {books.length > 0 && (
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                  <Search size={18} color={isDark ? '#b8a88a' : '#6b5744'} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    placeholder="Filtrar livros por título ou autor..." 
                    value={shelfSearchTerm} 
                    onChange={(e) => setShelfSearchTerm(e.target.value)} 
                    style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.8rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : '#ccc'}`, borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.2)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} 
                  />
                </div>
              )}
              {books.length === 0 && !showAddBook ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: isDark ? '#b8a88a' : '#6b5744' }}>
                  <Bookmark size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '1.1rem' }}>Sua estante está vazia. Adicione o livro que está lendo.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {(() => {
                    // A NOVA HIERARQUIA DAS ESTANTES

                    // Listas agora respeitam o termo de busca
                    const filteredBooks = books.filter(b => 
                      b.title.toLowerCase().includes(shelfSearchTerm.toLowerCase()) || 
                      b.author.toLowerCase().includes(shelfSearchTerm.toLowerCase())
                    );

                    const attentionBooks = filteredBooks.filter(b => !b.isPendingEnrichment && b.totalPages === 0);
                    const readBooks = filteredBooks.filter(b => b.status === 'lido' || b.finishedDate || (b.totalPages > 0 && b.currentPage >= b.totalPages));
                    const ownedBooks = filteredBooks.filter(b => b.status === 'juro' && !attentionBooks.includes(b) && !readBooks.includes(b));
                    const wishBooks = filteredBooks.filter(b => b.status === 'desejo' && !attentionBooks.includes(b) && !readBooks.includes(b));
                    const readingBooks = filteredBooks.filter(b => !attentionBooks.includes(b) && !readBooks.includes(b) && !ownedBooks.includes(b) && !wishBooks.includes(b));

                    const toggleDeleteSelection = (id) => {
                      if (selectedForDeletion.includes(id)) setSelectedForDeletion(prev => prev.filter(item => item !== id));
                      else setSelectedForDeletion(prev => [...prev, id]);
                    };

                    // Motor de renderização de Cards (para não repetir código)
                    const renderBookCard = (book, isWarning) => {
                      const progress = book.totalPages > 0 ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100)) : 0;
                      const isFinished = !!book.finishedDate || (progress >= 100 && book.totalPages > 0);
                      const isPending = book.isPendingEnrichment;

                      return (
                        <div key={book.id} style={{ background: isFinished ? (isDark ? 'rgba(76, 175, 80, 0.05)' : '#f0fdf4') : (isWarning ? (isDark ? 'rgba(231,76,60,0.05)' : '#fff5f5') : (isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)')), border: `1px solid ${isWarning ? '#e74c3c' : (isFinished ? '#4caf50' : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'))}`, borderRadius: '12px', padding: '1.2rem', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem' }}>
                          {/* CHECKBOX DE EXCLUSÃO EM LOTE (SÓ APARECE SE TIVER AVISO) */}
                          {isWarning && (
                            <input 
                              type="checkbox" 
                              checked={selectedForDeletion.includes(book.id)} 
                              onChange={() => toggleDeleteSelection(book.id)} 
                              style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 5, width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                          )}
                          {/* CAPA DO LIVRO */}
                          <div style={{ flexShrink: 0, width: '80px', height: '120px', background: '#333', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', position: 'relative' }}>
                            <img src={book.thumbnail || 'https://placehold.co/80x120/1a1a2e/d4af37?text=Sem+Capa'} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {isPending && (
                               <div className="animate-fadeIn" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', color: '#FFD700', fontSize: '0.65rem', textAlign: 'center', padding: '4px 0', fontWeight: 'bold' }}>Buscando...</div>
                            )}
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
                            
                            {book.category && (
                              <span style={{ alignSelf: 'flex-start', fontSize: '0.65rem', padding: '2px 6px', background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: '4px', color: isDark ? '#d4af37' : '#6b4423', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>{book.category}</span>
                            )}

                            {isWarning ? (
                               <div 
                              style={{ marginTop: 'auto', padding: '0.6rem', background: '#e74c3c', color: 'white', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 5px rgba(231, 76, 60, 0.3)' }} 
                              onClick={() => { 
                                setEditingBookId(book.id); 
                                setNewBook(book); 
                                setShowAddBook(true); 
                                
                                // PESQUISA AUTOMÁTICA COM DEBOUNCE LONGO:
                                 const queryTerm = `${book.title} ${book.author}`;
                                 setBookSearchQuery(queryTerm);
                                 
                                 // Se já tiver uma busca engatilhada, cancela para não encavalar
                                 if (window.searchTimeout) clearTimeout(window.searchTimeout);
                                 
                                 // Espera 1.5 segundos antes de atirar no Google
                                 window.searchTimeout = setTimeout(() => {
                                   searchBooks(queryTerm); 
                                 }, 1500);
                              }}
                            >
                              <Search size={14} /> Completar Dados
                            </div>
                            ) : (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.3rem' }}>
                                  <span>{isPending ? 'Analisando os astros...' : `${progress}% concluído`}</span>
                                  {isFinished && <span style={{ color: '#4caf50' }}>Lido em {book.finishedDate ? new Date(book.finishedDate).toLocaleDateString('pt-BR') : ''}</span>}
                                </div>
                                <div style={{ width: '100%', height: '6px', background: isDark ? 'rgba(255,255,255,0.1)' : '#eee', borderRadius: '3px', overflow: 'hidden', marginBottom: '1rem' }}>
                                  <div style={{ width: `${progress}%`, height: '100%', background: isFinished ? '#4caf50' : (isDark ? '#d4af37' : '#6b4423'), transition: 'width 0.8s ease' }}></div>
                                </div>

                                {!isFinished ? (
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button 
                                      onClick={() => {
                                      if(isPending) return alert("Aguarde o Oráculo encontrar as páginas deste livro primeiro, ou edite-o manualmente clicando no lápis acima.");
                                      const inputPagina = prompt(`Livro: ${book.title}\nTotal de páginas: ${book.totalPages}\n\nEm qual página você parou hoje?`, book.currentPage);
                                      if (inputPagina && !isNaN(inputPagina)) {
                                        const novaPaginaInformada = parseInt(inputPagina);
                                        if (novaPaginaInformada <= book.currentPage) return alert("A página informada é menor ou igual à atual.");

                                        const novaPag = Math.min(book.totalPages, novaPaginaInformada);
                                        const acabouAgora = (novaPag >= book.totalPages);
                                        
                                        const paginasAvançadasReais = novaPag - book.currentPage;
                                        const novoTotalGlobal = totalForgedPages + paginasAvançadasReais;

                                        const livroAtualizado = { ...book, currentPage: novaPag, finishedDate: acabouAgora ? new Date().toISOString() : null };
                                        saveBooksToDb(books.map(b => b.id === book.id ? livroAtualizado : b), novoTotalGlobal);

                                        if (acabouAgora) {
                                          alert(`Vitória! Você concluiu "${book.title}".`);
                                        } else if (paginasAvançadasReais > 0) {
                                          setPostReadInvite(livroAtualizado);
                                          if(aiConsent) generateTopicsForInvite(livroAtualizado);
                                        }
                                      }
                                    }}
                                      style={{ flex: 1, padding: '0.5rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : '#ccc'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                    >
                                      + Atualizar
                                    </button>                                    
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', color: '#4caf50', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid #4caf50', borderRadius: '6px', padding: '0.4rem' }}>
                                    <Award size={14} /> Leitura Finalizada
                                  </div>
                                )}
                              </>
                            )}
                            
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
                              {book.link && (
                                <a href={book.link} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '0.5rem', background: '#3498DB', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                  <FileText size={12} /> Abrir PDF
                                </a>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Abre ou fecha a gaveta do livro atual
                                  setExpandedNotesId(prev => prev === book.id ? null : book.id);
                                }}
                                style={{ flex: 1, padding: '0.5rem', background: expandedNotesId === book.id ? (isDark ? '#d4af37' : '#6b4423') : (isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0'), color: expandedNotesId === book.id ? (isDark ? '#1a1a2e' : 'white') : (isDark ? '#f0e6d2' : '#2c1810'), border: `1px solid ${expandedNotesId === book.id ? 'transparent' : (isDark ? '#555' : '#ccc')}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'all 0.2s' }}
                              >
                                <Edit size={12} /> {book.notes ? 'Ver Notas' : '+ Notas'}
                              </button>
                            </div>

                            {/* A GAVETA DE NOTAS EXPANSÍVEL */}
                            {expandedNotesId === book.id && (
                              <div className="animate-fadeIn" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                <textarea 
                                  value={book.notes || ''} 
                                  onChange={(e) => {
                                    // Atualiza a memória local enquanto você digita
                                    setBooks(books.map(b => b.id === book.id ? { ...b, notes: e.target.value } : b));
                                  }}
                                  placeholder="Suas reflexões, trechos marcantes, resumos de capítulos..."
                                  rows={5}
                                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.4)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem', fontFamily: 'Georgia, serif', resize: 'vertical' }}
                                />
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Salva no banco de dados e fecha a gaveta
                                    saveBooksToDb(books);
                                    setExpandedNotesId(null);
                                  }}
                                  style={{ alignSelf: 'flex-end', padding: '0.5rem 1.5rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 8px rgba(76,175,80,0.3)' }}
                                >
                                  <Save size={14} /> Salvar Fichamento
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    };
                            
                    return (
                      <>
                        {/* 1. SEÇÃO ESTOU LENDO */}
                        {readingBooks.length > 0 && (
                          <div>
                            <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={20} /> Em Forja (Lendo Agora)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                              {readingBooks.map(b => renderBookCard(b, false))}
                            </div>
                          </div>
                        )}

                        {/* 2. SEÇÃO PROMESSSAS (JÁ TENHO) */}
                        {ownedBooks.length > 0 && (
                          <div style={{ paddingTop: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bookmark size={18} /> Minha Biblioteca (Vou Começar)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                              {ownedBooks.map(b => renderBookCard(b, false))}
                            </div>
                          </div>
                        )}
                        
                        {/* 3. SEÇÃO REQUER ATENÇÃO (COM EXCLUSÃO EM LOTE) */}
                        {attentionBooks.length > 0 && (
                          <div style={{ paddingTop: '1.5rem', borderTop: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}`}}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                              <h3 style={{ margin: 0, color: '#e74c3c', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={18} /> Requer Atenção (Sem Páginas)</h3>
                              {selectedForDeletion.length > 0 && (
                                <button onClick={() => { if(window.confirm(`Apagar ${selectedForDeletion.length} livros permanentemente?`)) { saveBooksToDb(books.filter(b => !selectedForDeletion.includes(b.id))); setSelectedForDeletion([]); } }} style={{ background: '#e74c3c', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                                  🗑️ Apagar Selecionados ({selectedForDeletion.length})
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                              {attentionBooks.map(b => renderBookCard(b, true))}
                            </div>
                          </div>
                        )}

                        {/* 4. SEÇÃO LISTA DE DESEJOS */}
                        {wishBooks.length > 0 && (
                          <div style={{ paddingTop: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Star size={18} /> Lista de Desejos (Quero Comprar)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', opacity: 0.8 }}>
                              {wishBooks.map(b => renderBookCard(b, false))}
                            </div>
                          </div>
                        )}
                        
                        {/* 5. SEÇÃO JÁ LIDOS (GAVETA SANFONA) */}
                        {readBooks.length > 0 && (
                          <div style={{ paddingTop: '1.5rem', borderTop: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.2)'}`}}>
                            <div onClick={() => setShowReadBooks(!showReadBooks)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.5rem 0' }}>
                              <h3 style={{ margin: 0, color: '#4caf50', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={18} /> Sabedoria Acumulada ({readBooks.length} obras lidas)</h3>
                              {showReadBooks ? <ChevronUp size={20} color="#4caf50" /> : <ChevronDown size={20} color="#4caf50" />}
                            </div>
                            {showReadBooks && (
                              <div className="animate-fadeIn" style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {readBooks.sort((a,b) => new Date(b.finishedDate || 0) - new Date(a.finishedDate || 0)).map(b => renderBookCard(b, false))}
                              </div>
                            )}
                          </div>
                        )}

                      </>
                    );
                  })()}
                </div>
              )}             
            </div>
          </div>
        )}

              {/* MODAL DO ESCANER DE ESTANTE (FASE 4) */}
              {showScannerModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
                  <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '500px', width: '100%', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Search size={24} /> Olho de Argos
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
                            <div key={idx} style={{ display: 'flex', gap: '1rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, alignItems: 'center', position: 'relative' }}>
                              
                              {/* BOTÃO DISMISS (X) */}
                              <button onClick={() => dismissDetectedBook(b.title)} style={{ position: 'absolute', top: '-10px', right: '-10px', width: '24px', height: '24px', borderRadius: '50%', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', zIndex: 2 }}><X size={14} /></button>

                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <h4 style={{ margin: '0 0 0.2rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1rem' }}>{b.title}</h4>
                                <span style={{ fontSize: '0.8rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block', marginBottom: '0.5rem' }}>{b.author} {b.publisher ? `• ${b.publisher}` : ''}</span>
                                
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => handleQuickAdd(b, 'lido')} style={{ flex: 1, padding: '0.4rem', background: isDark ? '#4caf50' : '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>Já Li</button>
                                  <button onClick={() => handleQuickAdd(b, 'lendo')} style={{ flex: 1, padding: '0.4rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>Lendo</button>
                                  <button onClick={() => handleQuickAdd(b, 'juro')} style={{ flex: 1, padding: '0.4rem', background: 'transparent', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>Tenho (Vou Ler)</button>
                                  <button onClick={() => handleQuickAdd(b, 'desejo')} style={{ flex: 1, padding: '0.4rem', background: 'transparent', color: isDark ? '#b8a88a' : '#6b5744', border: `1px solid ${isDark ? '#555' : '#ccc'}`, borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>Desejo (Comprar)</button>
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

        {/* SEÇÃO DA BIBLIOTECA DE VIRTUDES (AGORA FUNDIDA COM LEITURAS E EM GAVETA) */}
        {view === 'leituras' && (
          <div className="animate-fadeIn" style={{ marginTop: '2rem' }}>
            <div style={getBlockStyle('partial', isVirtuesOpen, isDark ? '#d4af37' : '#8b7355')}>
              <div onClick={() => setIsVirtuesOpen(!isVirtuesOpen)} style={getHeaderStyle('partial', isVirtuesOpen)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Book size={28} color={isDark ? '#d4af37' : '#8b7355'} />
                  <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>
                    {fvUnlocked ? "Virtudes Acropolitanas" : "Biblioteca de Virtudes"}
                  </h2>
                </div>
                {isVirtuesOpen ? <ChevronUp size={24} color={isDark ? '#d4af37' : '#8b7355'} /> : <ChevronDown size={24} color={isDark ? '#d4af37' : '#8b7355'} />}
              </div>

              {isVirtuesOpen && (
                <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                  <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>
                    Conheça as virtudes que estamos estudando e suas práticas
                  </p>
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
                              <p style={{ fontSize: '0.95rem', color: isDark ? '#c8b896' : '#6b5744', margin: 0, lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                                {fvUnlocked ? (virtue.internalPractices || virtue.practices) : virtue.practices}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

                      // CONTAGEM DE PRÁTICAS (Em vez de tarefas)
                      const countPraticas = (ciclo) => ciclo.reduce((acc, curr) => {
                          let count = 0;
                          if (curr.fvDaily?.praticas) {
                              count += Object.values(curr.fvDaily.praticas).filter(v => v === true).length;
                          }
                          return acc + count;
                      }, 0);

                      const preenchimentosAtual = cicloAtual.length;
                      const preenchimentosAnterior = cicloAnterior.length;
                      const varPreenchimentos = preenchimentosAnterior === 0 ? 100 : Math.round(((preenchimentosAtual - preenchimentosAnterior) / preenchimentosAnterior) * 100);

                      const praticasAtual = countPraticas(cicloAtual);
                      const praticasAnterior = countPraticas(cicloAnterior);
                      const varPraticas = praticasAnterior === 0 ? 100 : Math.round(((praticasAtual - praticasAnterior) / praticasAnterior) * 100);

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

                              {/* Card 2: Práticas Realizadas */}
                              <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : '#ccc'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>Práticas Realizadas</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>{praticasAtual}</span>
                                  <span style={{ fontSize: '1rem', color: isDark ? '#888' : '#999' }}>ações</span>
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: varPraticas >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: varPraticas >= 0 ? (isDark ? '#81c784' : '#2e7d32') : '#e74c3c', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {varPraticas >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                                  {varPraticas > 0 ? '+' : ''}{varPraticas}%
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
                                <strong>Aviso Importante:</strong> Esta auditoria utiliza Inteligência Artificial. Ela mapeia o passado para que você construa o futuro. Confirme os padrões com seu Mestre.
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

        {/* VIEW: DISCIPULADO */}
        {view === 'gdve' && fvUnlocked && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* 1. RESUMO FIXO NO TOPO (Dashboard de Leitura) */}
            <div style={{ background: isDark ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, rgba(255, 165, 0, 0.05) 100%)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.3)' : '#ffe082'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 1.2rem 0', color: isDark ? '#ffd700' : '#d4af37', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}><Award size={20} /> Planejamento do Discipulado</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', paddingBottom: '1.5rem', borderBottom: `1px solid ${isDark ? 'rgba(255,215,0,0.1)' : 'rgba(139,115,85,0.1)'}`, marginBottom: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Minha Unidade</span>
                  <strong style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>{fvUnidade || 'Não definida'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Minha Condição</span>
                  <strong style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>{fvCondicao || 'Não definida'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Mestre / Instrutor</span>
                  <strong style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>{fvMasterName || 'Não definido'}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Próxima Entrega</span>
                  <strong style={{ color: '#e74c3c', fontSize: '1.1rem' }}>{fvNextCartaDate ? new Date(fvNextCartaDate + 'T12:00:00').toLocaleDateString('pt-BR') : '--/--/--'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Próxima Reunião</span>
                  <strong style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }}>{fvGdveReuniao ? new Date(fvGdveReuniao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '--/--/--'}</strong>
                </div>
              </div>
            </div>

            {/* 2. GAVETAS DO QUARTEL GENERAL */}
            {(() => {
              // Juiz de Acompanhamento (Checa também se a carta está atrasada)
              const planFilled = fvMasterName && fvLastMeetingDate && fvLastCartaDate && fvNextCartaDate;
              let planStatus = !fvMasterName ? 'empty' : (planFilled ? 'full' : 'partial');
              
              if (fvNextCartaDate) {
                const hojeStr = getTodayKey();
                if (fvNextCartaDate < hojeStr) {
                  planStatus = 'overdue'; // Aciona o alerta vermelho!
                }
              }

              // Juiz do Módulo GDVE (Bastião + Reunião + Práticas)
              const hasBastiao = fvGdveBastiaoName && fvGdveBastiaoName !== '';
              const hasMissoes = fvGdveTasks.length > 0;
              const todayEntryBadge = entries.find(e => e.date === getTodayKey());
              const todayGdveStatus = todayEntryBadge?.fvDaily?.gdveTasksStatus || {};
              const missoesCompletas = fvGdveTasks.filter(t => t.isCycle ? fvGdveCycleStatus[t.id] : (todayGdveStatus[t.id] >= t.target)).length;
              
              let gdveStatus = 'empty';
              if (hasBastiao || hasMissoes || fvDaily.gdveAttendance) {
                // A reunião só acontece a cada 15 dias, não pode ser exigência diária!
                if (hasMissoes) {
                  gdveStatus = (missoesCompletas === fvGdveTasks.length) ? 'full' : 'partial';
                } else {
                  // Se não tem missões, mas escolheu o Bastião, consideramos concluído
                  gdveStatus = hasBastiao ? 'full' : 'partial';
                }
              }

              // Juiz de Desafios Pessoais
              const totalD = customTasks.length;
              const feitosD = customTasks.filter(t => todayTasksStatus[t.id]).length;
              const desafiosStatus = totalD === 0 ? 'empty' : (feitosD === 0 ? 'empty' : (feitosD === totalD ? 'full' : 'partial'));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* GAVETA: MESTRE E CARTA */}
                  <div style={getBlockStyle(planStatus, isGdvePlanOpen, isDark ? '#FFD700' : '#996515')}>
                    <div onClick={() => setIsGdvePlanOpen(!isGdvePlanOpen)} style={getHeaderStyle(planStatus, isGdvePlanOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Shield size={28} color={isDark ? '#FFD700' : '#996515'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: planStatus === 'overdue' ? '#e74c3c' : (isDark ? '#f0e6d2' : '#2c1810'), fontFamily: "'Cinzel', serif", textDecoration: planStatus === 'full' && !isGdvePlanOpen ? 'line-through' : 'none' }}>
                          Mestre e Carta 
                          {planStatus === 'partial' && !isGdvePlanOpen && <span style={{fontSize: '0.8rem', opacity: 0.7}}> (Incompleto)</span>}
                          {planStatus === 'overdue' && !isGdvePlanOpen && <span style={{fontSize: '0.8rem', color: '#e74c3c', fontStyle: 'italic', fontFamily: 'Georgia, serif'}}> (Atrasada!)</span>}
                        </h2>
                      </div>
                      {isGdvePlanOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>

                    {isGdvePlanOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                         
                         {/* DADOS DE PERFIL */}
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Unidade</label>
                              <select value={fvUnidade || ''} onChange={(e) => setFvUnidade(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
                                <option value="">Selecione...</option>
                                {['ACROPOLEPLAY', 'AGORA', 'ÁGUAS CLARAS', 'ALTIPLANO', 'ALTO DA GLORIA', 'ANANINDEUA', 'ANÁPOLIS', 'ARAGUAINA', 'ASA NORTE', 'ASA SUL', 'BARRA DO GARÇAS', 'BELÉM', 'BOA VISTA', 'BODHIDHARMA', 'BRASÍLIA', 'BRASILIA SAMAMBAIA', 'CAMPINA GRANDE', 'CAMPO NOVO DO PARECIS', 'CARUARU', 'CATALÃO', 'CEILÂNDIA', 'CUIABÁ', 'FAZENDA NOVA ACRÓPOLE', 'FORMOSA', 'FORTALEZA DIONISIO TORRES', 'FORTALEZA FÁTIMA', 'FORTALEZA MEIRELES', 'FORTALEZA MESSEJANA', 'FORTALEZA SUL', 'GAMA', 'GOIANIA CIDADE JARDIM', 'GOIÂNIA ELDORADO', 'GOIANIA GARAVELO', 'GOIANIA II', 'GOIANIA ITUMBIARA', 'GOIANIA JARDIM AMÉRICA', 'GOIANIA SETOR OESTE', 'GOIÂNIA UNIVERSITARIO', 'GUARÁ', 'ITACA', 'JOÃO PESSOA', 'JUAZEIRO DO NORTE', 'LAGO SUL', 'MACAPÁ', 'MANAUS', 'MÓDULO SÃO JORGE', 'MOSSORÓ', 'MOSSORÓ ASSU', 'NATAL CANDELARIA', 'NATAL MORRO BRANCO', 'NATAL PONTA NEGRA', 'NATAL TIROL', 'NATAL ZONA NORTE', 'NOVA PARNAMIRIM', 'PALMAS', 'PALMAS AURENY', 'PETROLINA', 'PLANALTINA', 'PORTO VELHO', 'RECIFE BOA VIAGEM', 'RECIFE DERBY', 'RIO VERDE', 'RONDONÓPOLIS', 'SANTA MARIA', 'SÃO LUIS', 'SAO LUIS VINHAIS', 'SENADOR CANEDO', 'SERAPHIS', 'SINOP', 'SOBRADINHO', 'SOBRAL', 'SORRISO', 'SUDOESTE', 'TAGUATINGA', 'TERESINA', 'VALPARAISO', 'Outra'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Condição</label>
                              <select value={fvCondicao || ''} onChange={(e) => setFvCondicao(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }}>
                                <option value="">Selecione...</option>
                                {['GS', 'GF', 'GM', 'Prov GS', 'Prov GF', 'Prov GM'].map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Mestre / Instrutor (CD)</label>
                              <input type="text" value={fvMasterName || ''} onChange={(e) => setFvMasterName(e.target.value)} placeholder="Com quem você se reporta..." style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                            </div>
                         </div>

                         {/* DATAS DA CARTA */}
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Último Encontro / Entrevista</label>
                              <input type="date" value={fvLastMeetingDate || ''} onChange={(e) => setFvLastMeetingDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Última Entrega de Carta</label>
                              <input type="date" value={fvLastCartaDate || ''} onChange={(e) => { const novaData = e.target.value; setFvLastCartaDate(novaData); if (novaData) { const [ano, mes, dia] = novaData.split('-'); const dataCalculada = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1 + 3, parseInt(dia, 10)); setFvNextCartaDate(`${dataCalculada.getFullYear()}-${String(dataCalculada.getMonth() + 1).padStart(2, '0')}-${String(dataCalculada.getDate()).padStart(2, '0')}`); } else { setFvNextCartaDate(''); } }} style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Próxima Entrega (Previsão)</label>
                              <input type="date" value={fvNextCartaDate || ''} onChange={(e) => setFvNextCartaDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                            </div>
                         </div>
                         
                         {/* CONFIGURAÇÃO DO CALENDÁRIO DE ATIVIDADES (Com Múltiplos Dias e Horas) */}
                         <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : '#ccc'}`, marginBottom: '2rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1rem', fontFamily: "'Cinzel', serif" }}>Calendário Fixo de Atividades</h4>
                            
                            {/* Aulas Regulares e Raio */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                               <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666', fontWeight: 'bold' }}>Aula Regular (Curso)</label>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <select value={fvCalendar.aulaRegularDia} onChange={(e) => setFvCalendar({...fvCalendar, aulaRegularDia: e.target.value})} style={{ padding: '0.6rem', borderRadius: '6px', background: isDark ? 'rgba(26,26,46,0.8)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid #ccc' }}>
                                      <option value="">Selecione o Dia...</option>
                                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <input type="time" title="Início" value={fvCalendar.aulaRegularHora} onChange={(e) => setFvCalendar({...fvCalendar, aulaRegularHora: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }} />
                                      <span style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>até</span>
                                      <input type="time" title="Fim" value={fvCalendar.aulaRegularFim} onChange={(e) => setFvCalendar({...fvCalendar, aulaRegularFim: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }} />
                                    </div>
                                 </div>
                               </div>
                               <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666', fontWeight: 'bold' }}>Reunião de Raio</label>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <select value={fvCalendar.reuniaoRaioDia} onChange={(e) => setFvCalendar({...fvCalendar, reuniaoRaioDia: e.target.value})} style={{ padding: '0.6rem', borderRadius: '6px', background: isDark ? 'rgba(26,26,46,0.8)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid #ccc' }}>
                                      <option value="">Selecione o Dia...</option>
                                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <input type="time" title="Início" value={fvCalendar.reuniaoRaioHora} onChange={(e) => setFvCalendar({...fvCalendar, reuniaoRaioHora: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }} />
                                      <span style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>até</span>
                                      <input type="time" title="Fim" value={fvCalendar.reuniaoRaioFim} onChange={(e) => setFvCalendar({...fvCalendar, reuniaoRaioFim: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }} />
                                    </div>
                                 </div>
                               </div>
                            </div>

                            {/* Aulas Ministradas (Múltipla Seleção e Horários Individuais) */}
                            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                               <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666', fontWeight: 'bold' }}>Dias em que Ministro Aula (Múltipla escolha)</label>
                               
                               {/* Botões dos Dias */}
                               <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                 {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => {
                                   const isSelected = (fvCalendar.aulaMinistradaDias || []).includes(String(index));
                                   return (
                                     <button 
                                       key={index} 
                                       onClick={() => handleDiasMinistradosToggle(String(index))}
                                       style={{ padding: '0.5rem 0.8rem', background: isSelected ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: isSelected ? (isDark ? '#000' : '#fff') : (isDark ? '#b8a88a' : '#666'), border: `1px solid ${isSelected ? 'transparent' : '#ccc'}`, borderRadius: '6px', cursor: 'pointer', fontWeight: isSelected ? 'bold' : 'normal' }}
                                     >
                                       {dia}
                                     </button>
                                   )
                                 })}
                               </div>

                               {/* Linhas de Horário que aparecem dependendo do dia marcado */}
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                 {['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map((nomeDia, index) => {
                                    const diaStr = String(index);
                                    if (!(fvCalendar.aulaMinistradaDias || []).includes(diaStr)) return null;
                                    
                                    const tempos = (fvCalendar.aulaMinistradaTempos || {})[diaStr] || { inicio: '', fim: '' };
                                    
                                    return (
                                      <div key={diaStr} className="animate-fadeIn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', padding: '0.5rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.3)' : '#ddd'}` }}>
                                        <span style={{ fontSize: '0.85rem', color: isDark ? '#d4af37' : '#6b4423', width: '90px', fontWeight: 'bold' }}>{nomeDia}:</span>
                                        <input type="time" title="Início" value={tempos.inicio} onChange={(e) => { setFvCalendar(prev => ({ ...prev, aulaMinistradaTempos: { ...prev.aulaMinistradaTempos, [diaStr]: { ...prev.aulaMinistradaTempos?.[diaStr], inicio: e.target.value } } })); }} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', background: isDark ? 'rgba(26,26,46,0.8)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid #ccc' }} />
                                        <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.85rem' }}>até</span>
                                        <input type="time" title="Fim" value={tempos.fim} onChange={(e) => { setFvCalendar(prev => ({ ...prev, aulaMinistradaTempos: { ...prev.aulaMinistradaTempos, [diaStr]: { ...prev.aulaMinistradaTempos?.[diaStr], fim: e.target.value } } })); }} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', background: isDark ? 'rgba(26,26,46,0.8)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid #ccc' }} />
                                      </div>
                                    )
                                 })}
                               </div>
                            </div>

                            {/* Calendário de ED e CRM (Data Exata) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                               <div style={{ background: isDark ? 'rgba(155, 89, 182, 0.1)' : '#fdf8ff', padding: '1rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.3)' : '#e1bee7'}` }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: isDark ? '#c39bd3' : '#8e44ad', fontWeight: 'bold' }}>Data da Próxima CRM</label>
                                 <input type="date" value={fvCalendar.dataCrm} onChange={(e) => setFvCalendar({...fvCalendar, dataCrm: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: isDark ? 'rgba(26,26,46,0.8)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid #ccc' }} />
                               </div>
                               <div style={{ background: isDark ? 'rgba(74, 144, 226, 0.1)' : '#f4f8ff', padding: '1rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.3)' : 'rgba(74, 144, 226, 0.3)'}` }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: isDark ? '#6cb2eb' : '#2980b9', fontWeight: 'bold' }}>Data da Próxima ED</label>
                                 <input type="date" value={fvCalendar.dataAulaEd} onChange={(e) => setFvCalendar({...fvCalendar, dataAulaEd: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: isDark ? 'rgba(26,26,46,0.8)' : '#fff', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid #ccc' }} />
                               </div>
                            </div>
                         </div>
                         
                         <button 
                           onClick={() => {
                             saveFvPlanning();
                             setIsGdvePlanOpen(false);
                           }} 
                           style={{ padding: '0.8rem 1.5rem', width: '100%', justifyContent: 'center', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                         >
                           <Save size={18} /> Salvar Ficha Completa
                         </button>
                      </div>
                    )}
                  </div>

                  {/* GAVETA: MÓDULO GDVE (A Grande Fusão) */}
                  <div style={getBlockStyle(gdveStatus, isGdveMóduloOpen, isDark ? '#FFD700' : '#996515')}>
                    <div onClick={() => setIsGdveMóduloOpen(!isGdveMóduloOpen)} style={getHeaderStyle(gdveStatus, isGdveMóduloOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <BookOpen size={28} color={isDark ? '#FFD700' : '#996515'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif", textDecoration: gdveStatus === 'full' && !isGdveMóduloOpen ? 'line-through' : 'none' }}>
                          Módulo GDVE {gdveStatus === 'partial' && !isGdveMóduloOpen && <span style={{fontSize: '0.8rem', opacity: 0.7}}> (Em Andamento)</span>}
                        </h2>
                      </div>
                      {isGdveMóduloOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>

                    {isGdveMóduloOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                        
                        {/* Seção Reunião */}
                        <div style={{ padding: '1rem', background: fvDaily.gdveAttendance ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 215, 0, 0.05)', borderRadius: '12px', border: `1px solid ${fvDaily.gdveAttendance ? '#4caf50' : '#FFD700'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                           <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>Reunião Quinzenal:</span>
                           <button onClick={registerGdveAttendance} style={{ padding: '0.5rem 1rem', background: fvDaily.gdveAttendance ? '#4caf50' : 'transparent', color: fvDaily.gdveAttendance ? 'white' : '#FFD700', border: `1px solid ${fvDaily.gdveAttendance ? '#4caf50' : '#FFD700'}`, borderRadius: '6px', cursor: 'pointer' }}>
                             {fvDaily.gdveAttendance ? '✓ Presença Confirmada' : 'Marcar Presença'}
                           </button>
                        </div>

                        {/* Seção Leitura */}
                        <div style={{ marginBottom: '2rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Bastião / Leitura do Ciclo</label>
                          <select value={fvGdveBastiaoName} onChange={async (e) => { const val = e.target.value; setFvGdveBastiaoName(val); const found = fvConfig?.modulo2?.bancoTemas?.find(b => b.name === val); const novoLink = found ? found.link : ''; setFvGdveBastiaoLink(novoLink); if (user) await setDoc(doc(db, 'fvData', user.uid), { fvGdveBastiaoName: val, fvGdveBastiaoLink: novoLink }, { merge: true }); }} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, background: isDark ? 'rgba(26,26,46,0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                            <option value="">Selecione...</option>
                            {fvConfig?.modulo2?.bancoTemas?.map((b, idx) => <option key={idx} value={b.name}>{b.name}</option>)}
                          </select>
                          {fvGdveBastiaoLink && <a href={fvGdveBastiaoLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '1rem', color: isDark ? '#FFD700' : '#996515', fontWeight: 'bold' }}>🔗 Abrir PDF do Bastião</a>}
                        </div>

                        {/* Seção Práticas do Grupo */}
                        <h4 style={{ color: isDark ? '#FFD700' : '#996515', fontSize: '1rem', fontFamily: "'Cinzel', serif", marginBottom: '1rem' }}>Práticas Específicas do Ciclo</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                           {fvGdveTasks.map(task => {
                             // Lógica para saber que tipo de tarefa é
                             const isCycle = task.isCycle;
                             const isCounter = !isCycle && task.target > 1;
                             let isCompleted = false;
                             let displayValue = '';

                             // Puxa o valor do dia ou do ciclo global
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
                               <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: '8px', border: `1px solid ${taskColor}`, transition: 'all 0.3s ease' }}>
                                 <div onClick={() => toggleGdveTask(task)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                   
                                   {/* Renderiza um Número se for meta diária, ou um Checkbox se for os outros */}
                                   {isCounter ? (
                                      <div style={{ padding: '0.3rem 0.6rem', background: taskColor, border: `1px solid ${taskColor}`, borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '0.8rem', minWidth: '40px', textAlign: 'center' }}>
                                        {displayValue}
                                      </div>
                                   ) : (
                                      <input type="checkbox" checked={isCompleted} readOnly style={{ width: '18px', height: '18px', accentColor: '#4caf50' }} />
                                   )}
                                   
                                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                                     <span style={{ color: isCompleted ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), textDecoration: isCompleted ? 'line-through' : 'none' }}>
                                       {task.name}
                                     </span>
                                     <span style={{ fontSize: '0.7rem', color: isDark ? '#b8a88a' : '#888', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                                        {isCycle ? '⏳ Missão do Ciclo (Não zera)' : (isCounter ? '📅 Meta Diária' : '📅 Prática Diária')}
                                     </span>
                                   </div>

                                 </div>
                                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                                   <button onClick={(e) => { e.stopPropagation(); startEditingGdveTask(task); }} style={{ background: 'transparent', border: 'none', color: isDark ? '#d4af37' : '#996515', cursor: 'pointer' }} title="Editar"><Edit size={16} /></button>
                                   <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Deseja excluir esta prática?')) removeGdveTask(task.id); }} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }} title="Excluir"><Trash2 size={16} /></button>
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : '#ccc'}` }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <h5 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                               {editingGdveTaskId ? 'Editar Prática' : 'Adicionar Nova Prática'}
                             </h5>
                             {editingGdveTaskId && (
                               <button onClick={() => { setEditingGdveTaskId(null); setNewGdveTaskName(''); setNewGdveTaskTarget(1); setNewGdveTaskIsCycle(false); }} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>
                                 <X size={16}/>
                               </button>
                             )}
                           </div>
                           
                           <input type="text" value={newGdveTaskName} onChange={(e) => setNewGdveTaskName(e.target.value)} placeholder="Ex: Ler Bastião / Eu sou Discípulo..." style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif' }} />
                           
                           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666' }}>
                                 <input type="checkbox" checked={newGdveTaskIsCycle} onChange={(e) => { setNewGdveTaskIsCycle(e.target.checked); if(e.target.checked) setNewGdveTaskTarget(1); }} style={{ width: '16px', height: '16px', accentColor: '#FFD700', cursor: 'pointer' }} />
                                 Missão Única do Ciclo (Não zera diariamente)
                              </label>
                              
                              {!newGdveTaskIsCycle && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666' }}>
                                   Vezes por dia:
                                   <input type="number" min="1" max="10" value={newGdveTaskTarget} onChange={(e) => setNewGdveTaskTarget(parseInt(e.target.value) || 1)} style={{ width: '60px', padding: '0.4rem', borderRadius: '4px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', textAlign: 'center' }} />
                                </label>
                              )}

                              <button onClick={addGdveTask} style={{ marginLeft: 'auto', padding: '0.6rem 1.5rem', background: isDark ? '#FFD700' : '#996515', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.2s' }}>
                                 {editingGdveTaskId ? 'Salvar Alteração' : '+ Adicionar'}
                              </button>
                           </div>
                        </div>
                        
                        <button 
                          onClick={() => {
                            setIsGdveMóduloOpen(false); // Fecha a gaveta
                            alert('✅ Módulo GDVE atualizado com sucesso!');
                          }} 
                          style={{ marginTop: '2rem', width: '100%', padding: '0.8rem 1.5rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle size={18} /> Salvar Módulo GDVE
                        </button>

                      </div>
                    )}
                  </div>

                  {/* GAVETA: DESAFIOS PESSOAIS */}
                  <div style={getBlockStyle(desafiosStatus, isGdveDesafiosOpen, isDark ? '#6cb2eb' : '#2980b9')}>
                    <div onClick={() => setIsGdveDesafiosOpen(!isGdveDesafiosOpen)} style={getHeaderStyle(desafiosStatus, isGdveDesafiosOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Swords size={28} color={isDark ? '#6cb2eb' : '#2980b9'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif", textDecoration: desafiosStatus === 'full' && !isGdveDesafiosOpen ? 'line-through' : 'none' }}>
                          Desafios Pessoais
                        </h2>
                      </div>
                      {isGdveDesafiosOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                    {isGdveDesafiosOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                         {customTasks.map(task => (
                           <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: '8px', border: `1px solid ${todayTasksStatus[task.id] ? '#4caf50' : '#eee'}`, marginBottom: '0.5rem' }}>
                              <div onClick={() => toggleTaskStatus(task.id)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                 <input type="checkbox" checked={!!todayTasksStatus[task.id]} readOnly style={{ width: '18px', height: '18px' }} />
                                 <span style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>{task.name}</span>
                              </div>
                              <button onClick={() => removeCustomTask(task.id)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><Trash2 size={16} /></button>
                           </div>
                         ))}
                         <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Novo desafio pessoal..." style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: '1px solid #ccc', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                            <button onClick={saveCustomTask} style={{ padding: '0 1rem', background: isDark ? '#6cb2eb' : '#2980b9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>+</button>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {/* GAVETA: RELATÓRIO MENSAL FV */}
                  <div style={getBlockStyle('partial', isGdveRelatorioOpen, isDark ? '#9B59B6' : '#8E44AD')}>
                    <div onClick={() => setIsGdveRelatorioOpen(!isGdveRelatorioOpen)} style={getHeaderStyle('partial', isGdveRelatorioOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FileText size={28} color={isDark ? '#c39bd3' : '#8e44ad'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>
                          Relatório Mensal do Ciclo
                        </h2>
                      </div>
                      {isGdveRelatorioOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>

                    {isGdveRelatorioOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                        {/* PAINEL DE RESULTADOS AUTOMATIZADOS DO CICLO */}
                        {(() => {
                          const s = getFvMonthlyStats();
                          const Badge = ({ icon: Icon, label, value, color }) => (
                            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', padding: '1rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: color || (isDark ? '#b8a88a' : '#64748b'), fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <Icon size={14} /> {label}
                              </div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isDark ? '#f0e6d2' : '#1e293b', fontFamily: 'Georgia, serif' }}>
                                {value}
                              </div>
                            </div>
                          );

                          const getPraticasBadgeInfo = (dias) => {
                            if (dias >= 28) return { label: 'Sempre', color: '#FFD700', icon: Sun };
                            if (dias >= 20) return { label: 'Frequente', color: '#ff9800', icon: Flame };
                            if (dias >= 12) return { label: 'Às vezes', color: '#4caf50', icon: Target };
                            if (dias > 0) return { label: 'Raramente', color: '#e74c3c', icon: Sparkles };
                            return { label: 'Nunca', color: isDark ? '#555' : '#999', icon: Moon };
                          };

                          return (
                            <div style={{ marginBottom: '2.5rem' }}>
                              <div style={{ background: isDark ? 'rgba(155, 89, 182, 0.1)' : '#fdf8ff', padding: '1rem', borderRadius: '12px', borderLeft: `4px solid ${isDark ? '#c39bd3' : '#8e44ad'}`, marginBottom: '1.5rem' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.5' }}>
                                  <strong>Inteligência do Diário:</strong> Os dados abaixo foram extraídos dos seus registros diários e missões. Eles já estão prontos para o seu relatório oficial.
                                </p>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                <Badge icon={Clock} label="Voluntariado" value={s.hVol} color="#8e44ad" />
                                <Badge icon={BookOpen} label="Aulas Assistidas" value={s.hAs} color="#3498db" />
                                <Badge icon={Target} label="Aulas Ministradas" value={s.hMin} color="#e67e22" />
                                <Badge icon={Zap} label="Freq. de Práticas" value={s.freqPraticas} color="#f1c40f" />
                                <Badge icon={CheckCircle} label="Aulas de Curso" value={`${s.countAulaRegular} presenças`} />
                                <Badge icon={Award} label="Aulas de ED" value={`${s.countEd} presenças`} />
                                <Badge icon={Shield} label="CRM Mensal" value={s.countCrm > 0 ? 'Participou' : 'Não registrada'} />
                                <Badge icon={Star} label="Reuniões de Raio" value={`${s.countRaio} encontros`} />
                                <Badge icon={Mountain} label="Escalas de Limpeza" value={`${s.countLimpeza} check-ins`} />
                                <Badge icon={Sunrise} label="Guarda Noturna (GN)" value={`${s.countGN} turnos`} />
                              </div>
                            </div>
                          );
                        })()}

                        

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                          
                          {/* INFORMAÇÕES QUE O APP NÃO PODE ADIVINHAR */}
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Participou das outras CRM (Extras/Especiais)?</label>
                              <select value={monthlyReport.outrasCrm} onChange={(e) => handleMonthlyReportChange('outrasCrm', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}` }}>
                                <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option><option value="Não teve CRM extra">Não teve CRM extra</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Quantos bastiões leu esse mês?</label>
                              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '-0.3rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>*Se você tiver uma Tarefa chamada "Bastião", o app calculará sozinho.</p>
                              <select value={monthlyReport.bastioesLidos} onChange={(e) => handleMonthlyReportChange('bastioesLidos', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}` }}>
                                <option value="">Automático pelo App (ou Selecione)</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5 ou mais">5 ou mais</option><option value="Nenhum">Nenhum</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ height: '1px', background: isDark ? 'rgba(155, 89, 182, 0.2)' : 'rgba(142, 68, 173, 0.2)' }}></div>

                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Envolvimento com a Propaganda (Múltipla escolha)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                              {['Contato Pessoal', 'Divulgação WhatsApp', 'Redes Sociais (Insta/Face)', 'Cartazes/Folhetos', 'Não tenho me envolvido'].map(op => (
                                <label key={op} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', borderRadius: '6px' }}>
                                  <input type="checkbox" checked={(monthlyReport.propaganda || []).includes(op)} onChange={() => handlePropagandaToggle(op)} style={{ width: '18px', height: '18px', accentColor: '#8e44ad' }} />
                                  <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>{op}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Pagou contribuição mensal?</label>
                              <select value={monthlyReport.contribuicao} onChange={(e) => handleMonthlyReportChange('contribuicao', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}` }}>
                                <option value="">Selecione...</option><option value="Sim, estou em dias">Sim, em dias</option><option value="Sim, mas com atraso">Sim, mas com atraso</option><option value="Não">Não</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Fez alguma doação extra?</label>
                              <select value={monthlyReport.doacao} onChange={(e) => handleMonthlyReportChange('doacao', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}` }}>
                                <option value="">Selecione...</option><option value="Em espécie">Sim, em espécie</option><option value="Objeto que necessitavam">Objeto necessitado</option><option value="Espécie e Objeto">Ambos</option><option value="Não tive condições/Lembrei">Não</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ height: '1px', background: isDark ? 'rgba(155, 89, 182, 0.2)' : 'rgba(142, 68, 173, 0.2)' }}></div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                             <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Secretaria de Atuação</label>
                                <select value={monthlyReport.secretariaAtuacao} onChange={(e) => handleMonthlyReportChange('secretariaAtuacao', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}` }}>
                                  <option value="">Nenhuma / Selecione...</option>
                                  {['Abertura de Turma', 'Artes', 'Biblioteca', 'Café Artemis', 'Difusão', 'Economia', 'Escolástica', 'GGFF', 'GGMM', 'GGSS', 'Integração', 'Livraria', 'Manutenção', 'Programa Janos', 'Programa Merlin', 'Escola do Esporte', 'Círculo de Amigos', 'Assuntos Legais', 'GEA', 'Assistência Social'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                             </div>
                             <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                               <div>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Trabalhou/reuniu com os membros da sec.?</label>
                                  <input type="text" value={monthlyReport.secretariaReuniao} onChange={(e) => handleMonthlyReportChange('secretariaReuniao', e.target.value)} placeholder="Breve relato..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, fontFamily: 'Georgia, serif' }} />
                               </div>
                               <div>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Quantos membros? Algum destaque?</label>
                                  <input type="text" value={monthlyReport.secretariaMembros} onChange={(e) => handleMonthlyReportChange('secretariaMembros', e.target.value)} placeholder="Quantidade e destaques..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, fontFamily: 'Georgia, serif' }} />
                               </div>
                             </div>
                          </div>

                          <div style={{ height: '1px', background: isDark ? 'rgba(155, 89, 182, 0.2)' : 'rgba(142, 68, 173, 0.2)' }}></div>

                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Indique 1 ou 2 pontos positivos/crescimento deste mês</label>
                            <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#888', marginTop: '-0.3rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>Momento de síntese pessoal: extraia suas vitórias com suas próprias palavras.</p>
                            <textarea value={monthlyReport.pontosPositivos} onChange={(e) => handleMonthlyReportChange('pontosPositivos', e.target.value)} rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, fontFamily: 'Georgia, serif', resize: 'vertical' }} />
                          </div>

                          <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#c39bd3' : '#8e44ad' }}>Indique um desafio que você está percebendo para crescer</label>
                            <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#888', marginTop: '-0.3rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>Olhe para si mesmo e defina com clareza o seu principal obstáculo (Kurava) atual.</p>
                            <textarea value={monthlyReport.desafioCrescimento} onChange={(e) => handleMonthlyReportChange('desafioCrescimento', e.target.value)} rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.4)' : '#ccc'}`, fontFamily: 'Georgia, serif', resize: 'vertical' }} />
                          </div>

                          <button onClick={generateMonthlyReportText} style={{ width: '100%', padding: '1.2rem', background: 'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 6px 15px rgba(155, 89, 182, 0.3)', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                            <FileText size={22} /> Gerar Relatório e Copiar
                          </button>

                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}
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

        {showQuickFv && (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setShowQuickFv(false)}>
    <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '1.5rem', borderRadius: '16px', maxWidth: '380px', width: '100%', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setShowQuickFv(false)} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={20} /></button>

      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <Shield size={40} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 0.5rem' }} />
        <h2 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.4rem' }}>Missões do Dia</h2>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744' }}>{missoesCompletas} de {fvGdveTasks.length} concluídas hoje</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {fvGdveTasks.map(task => {
          const isCycle = task.isCycle;
          const currentCount = todayGdveStatus[task.id] || 0;
          const isCompleted = isCycle ? !!fvGdveCycleStatus[task.id] : currentCount >= (task.target || 1);
          return (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: '8px', border: `1px solid ${isCompleted ? '#4caf50' : (isDark ? 'rgba(255,215,0,0.2)' : '#eee')}` }}>
              <input type="checkbox" checked={isCompleted} readOnly style={{ width: '18px', height: '18px', accentColor: '#4caf50' }} />
              <span style={{ color: isDark ? '#f0e6d2' : '#2c1810', textDecoration: isCompleted ? 'line-through' : 'none', opacity: isCompleted ? 0.6 : 1 }}>{task.name}</span>
            </div>
          );
        })}
      </div>

      <button onClick={() => { setShowQuickFv(false); setView('gdve'); }} style={{ marginTop: '1.5rem', width: '100%', padding: '0.8rem', background: isDark ? '#FFD700' : '#996515', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
        Abrir Discipulado
      </button>
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

              <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: isDark ? '#d4af37' : '#6b4423', fontWeight: 'bold' }}>⚔️ Lembrete de Missões e Práticas</label>
                <input type="time" value={taskReminderTime} onChange={(e) => setTaskReminderTime(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: `1px solid ${isDark ? '#d4af37' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.1rem' }} />
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
      
      {/* ============================================================== */}
      {/* MODAL DE PRÁTICAS (Abre ao clicar no Badge "Às vezes/Frequente") */}
      {showPracticesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setShowPracticesModal(false)}>
          <div className="animate-fadeIn" style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '1.5rem', borderRadius: '16px', maxWidth: '380px', width: '100%', border: `2px solid ${pb.color}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPracticesModal(false)} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={20} /></button>
            
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <PraticaIcon size={46} color={pb.color} style={{ margin: '0 auto 0.5rem' }} />
              <h2 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.5rem' }}>Constância de Práticas</h2>
            </div>

            <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff', padding: '1.2rem', borderRadius: '12px', border: `1px solid ${pb.color}`, textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', color: pb.color, display: 'block', marginBottom: '0.2rem' }}>Grau Atual</span>
              <h3 style={{ margin: '0 0 0.25rem', fontFamily: "'Cinzel', serif", fontSize: '1.4rem', color: isDark ? '#f0e6d2' : '#2c1810' }}>{pb.label}</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>Realizadas em {statsMenu.diasPraticas} dias neste ciclo.</p>
              
              {(() => {
                 const dias = statsMenu.diasPraticas;
                 let next = null;
                 if (dias < 1) next = { min: 1, title: 'Raramente' };
                 else if (dias < 12) next = { min: 12, title: 'Às vezes' };
                 else if (dias < 20) next = { min: 20, title: 'Frequente' };
                 else if (dias < 28) next = { min: 28, title: 'Sempre' };
                 
                 if (next) {
                   return (
                     <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                         <span>Rumo a: {next.title}</span>
                         <span>Faltam {next.min - dias} dias</span>
                       </div>
                       <div style={{ width: '100%', height: '8px', background: isDark ? 'rgba(255,255,255,0.1)' : '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                         <div style={{ width: `${Math.min(100, (dias / next.min) * 100)}%`, height: '100%', background: pb.color, transition: 'width 0.5s ease' }}></div>
                       </div>
                     </div>
                   );
                 } else {
                   return (
                     <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                       <p style={{ margin: 0, fontSize: '0.85rem', color: pb.color, fontWeight: 'bold' }}>🌟 Você manteve práticas impecáveis neste ciclo!</p>
                     </div>
                   );
                 }
              })()}
            </div>

            <button onClick={() => { setShowPracticesModal(false); setShowQuickFv(true); }} style={{ width: '100%', padding: '1rem', background: pb.color, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: `0 4px 15px ${pb.color}40`, transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
              <Zap size={20} /> Realizar Práticas Agora
            </button>
          </div>
        </div>
      )}
      
      {/* WIDGET FLUTUANTE DE TAREFAS GDVE (ESTRELA) */}
      {fvUnlocked && view !== 'fv' && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
          
          {/* Painel Aberto */}
          {showQuickFv && (
            <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(253, 251, 247, 0.98)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', width: 'max-content', maxWidth: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.1rem' }}><Star size={18} /> Missões e Práticas</h4>
                <button onClick={() => setShowQuickFv(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#aaa' : '#777', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.2rem' }}>
                
                {/* BLOCO ESPECIAL: LEITURA DE BASTIÃO DO CICLO */}
                {fvGdveBastiaoName && (
                  <div style={{ padding: '0.8rem', background: isDark ? 'rgba(0,0,0,0.4)' : '#fff', borderRadius: '8px', border: `1px solid ${fvGdveCycleStatus['bastiao'] ? '#4caf50' : (isDark ? '#d4af37' : '#996515')}`, marginBottom: '0.5rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    <span style={{ display: 'block', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.3rem' }}>Leitura do Ciclo</span>
                    <span style={{ display: 'block', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.8rem', lineHeight: '1.3' }}>{fvGdveBastiaoName}</span>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => {
                         const newStatus = { ...fvGdveCycleStatus, bastiao: !fvGdveCycleStatus['bastiao'] };
                         setFvGdveCycleStatus(newStatus);
                         if(user) setDoc(doc(db, 'fvData', user.uid), { gdveCycleStatus: newStatus }, { merge: true });
                      }} style={{ flex: 1, padding: '0.5rem', background: fvGdveCycleStatus['bastiao'] ? '#4caf50' : 'transparent', color: fvGdveCycleStatus['bastiao'] ? 'white' : (isDark ? '#f0e6d2' : '#2c1810'), border: `1px solid ${fvGdveCycleStatus['bastiao'] ? '#4caf50' : (isDark ? '#555' : '#ccc')}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'all 0.2s' }}>
                         {fvGdveCycleStatus['bastiao'] ? <CheckCircle size={14}/> : <div style={{width:'14px', height:'14px', borderRadius:'50%', border:'1px solid currentColor'}}></div>}
                         {fvGdveCycleStatus['bastiao'] ? 'Já Li' : 'Marcar Lido'}
                      </button>
                      
                      {fvGdveBastiaoLink && (
                         <a href={fvGdveBastiaoLink} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '0.5rem', background: isDark ? 'rgba(74, 144, 226, 0.2)' : '#e3f2fd', color: isDark ? '#6cb2eb' : '#2980b9', border: `1px solid ${isDark ? '#6cb2eb' : '#2980b9'}`, borderRadius: '6px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'all 0.2s' }}>
                           <BookOpen size={14} /> Ler Agora
                         </a>
                      )}
                    </div>
                  </div>
                )}

                {/* 1. TODAS AS MISSÕES DO GDVE (DIÁRIAS E DE CICLO) */}
                {fvGdveTasks.length > 0 && (
                  fvGdveTasks.map(task => {
                    const isCycle = task.isCycle;
                    const currentCount = (typeof fvDaily.gdveTasksStatus?.[task.id] === 'boolean' ? (fvDaily.gdveTasksStatus[task.id] ? 1 : 0) : fvDaily.gdveTasksStatus?.[task.id]) || 0;
                    const targetCount = task.target || 1;
                    
                    let isCompleted = false;
                    let displayValue = '';
                    if (isCycle) {
                       isCompleted = !!fvGdveCycleStatus[task.id];
                       displayValue = isCompleted ? '✓' : '⏳';
                    } else {
                       isCompleted = currentCount >= targetCount;
                       displayValue = `${currentCount}/${targetCount}`;
                    }
                    
                    return (
                      <div key={task.id} onClick={() => toggleGdveTask(task)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: isCompleted ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : '#fff'), borderRadius: '8px', border: `1px solid ${isCompleted ? '#4caf50' : (isDark ? '#555' : '#ccc')}`, cursor: 'pointer', transition: 'all 0.2s', gap: '1rem', marginBottom: '0.2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: isCompleted ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '0.9rem', fontWeight: isCompleted ? 'bold' : 'normal', textDecoration: isCompleted ? 'line-through' : 'none' }}>{task.name}</span>
                          {isCycle && <span style={{ fontSize: '0.65rem', color: isDark ? '#b8a88a' : '#888', textTransform: 'uppercase', marginTop: '0.2rem', fontWeight: 'bold' }}>Missão do Ciclo</span>}
                        </div>
                        <div style={{ background: isCompleted ? '#4caf50' : (isDark ? '#333' : '#eee'), color: isCompleted ? '#fff' : (isDark ? '#b8a88a' : '#666'), padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {displayValue}
                        </div>
                      </div>
                    );
                  })
                )}

                {fvConfig?.praticas && (
                  <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0.5rem 0' }}></div>
                )}

                {/* 2. PRÁTICAS FIXAS DA ESCOLA */}
                {fvConfig?.praticas?.map(prac => {
                  const isCompleted = !!fvDaily.praticas?.[prac.key];
                  return (
                    <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: isCompleted ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : '#fff'), borderRadius: '8px', border: `1px solid ${isCompleted ? '#4caf50' : (isDark ? 'rgba(212,175,55,0.3)' : '#ccc')}`, cursor: 'pointer', transition: 'all 0.2s', gap: '1rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: isCompleted ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '0.9rem', fontWeight: isCompleted ? 'bold' : 'normal', textDecoration: isCompleted ? 'line-through' : 'none' }}>{prac.label}</span>
                      {isCompleted ? <CheckCircle size={16} color="#4caf50" /> : <Zap size={16} color={isDark ? '#b8a88a' : '#ccc'} />}
                    </div>
                  );
                })}
                
                {(!fvGdveBastiaoName && fvGdveTasks.length === 0 && (!fvConfig?.praticas || fvConfig.praticas.length === 0)) && (
                   <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#888', fontStyle: 'italic', textAlign: 'center' }}>Nenhuma prática ou missão pendente.</p>
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