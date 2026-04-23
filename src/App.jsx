import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sunrise, Sunset, Search, Calendar, Moon, Sun, 
  Sparkles, ChevronRight, LogOut, Shuffle, Plus, X, 
  AlertCircle, Eye, EyeOff, CheckCircle, Download, Upload,
  Target, TrendingUp, Award, FileText, Book, Settings,
  Trash2, Edit, Save, XCircle, Flame, Zap, Shield, Star, Crown, 
  Bell, Check, Music, MessageSquare, Menu, Lock, ChevronDown, ChevronUp, 
  Mountain, Landmark
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
  // Estados de Autenticação
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

  // Estados das Notificações
  const [notificationsActive, setNotificationsActive] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [morningTime, setMorningTime] = useState('06:00');
  const [eveningTime, setEveningTime] = useState('22:00');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Controle de Instalação do PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

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
  const [yearGoals, setYearGoals] = useState('');
  const [lifeGoals, setLifeGoals] = useState('');
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
  
  // Estado Diário da Carta de Degrau FV
  const [fvDaily, setFvDaily] = useState({
    item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
    horasGuarda: '', horasAula: '',
    gdveTasksStatus: {}, gdveAttendance: false,
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
  
  // ESTADO DO TEMPLO
  const [temploSelections, setTemploSelections] = useState({ porta: false, patioAberto: false, patioColunas: false, santuario: false });

  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const audioRef = useRef(null); 

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
        horasGuarda: '', horasAula: '', gdveTasksStatus: {}, gdveAttendance: false,
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
    else {
      alert('Esta é uma prática de foro íntimo e sagrado. Por favor, faça a sua recitação privadamente e marque a opção "Já Realizado".');
    }
  };

  const enterFullScreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(e => console.log(e)); }
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
  };

  const exitFullScreen = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) { document.exitFullscreen().catch(e => console.log(e)); }
      else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
    }
  };

  const virtues = [
    { name: "Paciência", shortDesc: "Suportar dificuldades mantendo a serenidade", description: "A capacidade de suportar dificuldades sem se perturbar, mantendo a serenidade diante das adversidades e do tempo necessário para as coisas se realizarem.", practices: "• Respirar profundamente antes de reagir\n• Observar a irritação sem agir impulsivamente\n• Lembrar que tudo tem seu tempo", color: "#4A90E2" },
    { name: "Ordem", shortDesc: "Harmonia no mundo exterior e interior", description: "Disposição harmoniosa das coisas em seu devido lugar, tanto no mundo exterior quanto no interior.", practices: "• Organizar espaço físico diariamente\n• Criar rotinas conscientes\n• Planejar o dia com antecedência", color: "#7B68EE" },
    { name: "Generosidade", shortDesc: "Dar livremente sem esperar retorno", description: "Compartilhar tempo, atenção, recursos e conhecimento com quem necessita, sem expectativa de recompensa.", practices: "• Oferecer ajuda sem ser pedido\n• Compartilhar conhecimento\n• Doar tempo e atenção genuína", color: "#50C878" },
    { name: "Coragem", shortDesc: "Agir corretamente mesmo sob pressão", description: "Força interior para enfrentar o medo, agir corretamente mesmo sob pressão e defender princípios mesmo quando difícil.", practices: "• Fazer o certo mesmo com medo\n• Falar a verdade com tato\n• Enfrentar desafios ao invés de evitá-los", color: "#E74C3C" },
    { name: "Temperança", shortDesc: "Moderação e equilíbrio", description: "Moderação em todas as coisas, equilíbrio entre extremos, domínio sobre impulsos e desejos desmedidos.", practices: "• Evitar excessos em todas as áreas\n• Buscar o meio-termo\n• Dominar impulsos automáticos", color: "#9B59B6" },
    { name: "Honestidade", shortDesc: "Viver em consonância com a verdade", description: "Ser íntegro em palavras e ações, não enganar a si mesmo nem aos outros.", practices: "• Falar a verdade com compaixão\n• Reconhecer erros abertamente\n• Ser transparente nas intenções", color: "#3498DB" },
    { name: "Humildade", shortDesc: "Reconhecer limitações e estar aberto", description: "Reconhecer limitações sem falsa modéstia, estar aberto a aprender, não se colocar acima dos outros.", practices: "• Ouvir mais que falar\n• Reconhecer que sempre há mais a aprender\n• Aceitar críticas construtivas", color: "#95A5A6" },
    { name: "Disciplina", shortDesc: "Manter compromissos consigo mesmo", description: "Capacidade de seguir princípios escolhidos mesmo sem supervisão externa.", practices: "• Cumprir pequenos compromissos diários\n• Manter práticas mesmo sem vontade\n• Criar e seguir uma rotina", color: "#34495E" },
    { name: "Compaixão", shortDesc: "Sentir com o outro", description: "Compreender o sofrimento alheio e agir para aliviá-lo quando possível.", practices: "• Ver além das aparências\n• Oferecer presença empática\n• Perdoar falhas humanas", color: "#E67E22" },
    { name: "Prudência", shortDesc: "Sabedoria prática", description: "Avaliar situações, prever consequências e tomar decisões ponderadas.", practices: "• Pensar antes de agir\n• Considerar consequências\n• Buscar conselho quando necessário", color: "#16A085" },
    { name: "Justiça", shortDesc: "Dar a cada um o que lhe é devido", description: "Agir com equidade, respeitar direitos e cumprir deveres.", practices: "• Tratar todos com equidade\n• Cumprir compromissos assumidos\n• Reconhecer méritos alheios", color: "#C0392B" },
    { name: "Gratidão", shortDesc: "Reconhecer e valorizar", description: "Cultivar apreciação pelas bênçãos da vida.", practices: "• Agradecer diariamente por três coisas\n• Valorizar pequenas coisas\n• Expressar reconhecimento aos outros", color: "#F39C12" },
    { name: "Serenidade", shortDesc: "Paz interior", description: "Tranquilidade da mente e do coração independente das circunstâncias.", practices: "• Meditar regularmente\n• Não reagir automaticamente\n• Cultivar paz interior através da contemplação", color: "#1ABC9C" },
    { name: "Diligência", shortDesc: "Aplicação cuidadosa", description: "Fazer bem o que precisa ser feito, com atenção e dedicação.", practices: "• Fazer cada tarefa com atenção plena\n• Não deixar para depois\n• Completar o que começou", color: "#2ECC71" },
    { name: "Bondade", shortDesc: "Inclinação natural para o bem", description: "Agir com gentileza e benevolência em todas as circunstâncias.", practices: "• Fazer pequenos gestos gentis diariamente\n• Falar palavras encorajadoras\n• Agir com benevolência mesmo quando difícil", color: "#FF69B4" },
    { name: "Sabedoria", shortDesc: "Conhecimento com discernimento", description: "Compreensão profunda da vida e capacidade de ver a essência das coisas.", practices: "• Estudar filosofia regularmente\n• Refletir sobre experiências\n• Buscar compreensão profunda, não superficial", color: "#8E44AD" },
    { name: "Fortaleza", shortDesc: "Resistência interior", description: "Perseverar em objetivos nobres mesmo diante de dificuldades prolongadas.", practices: "• Perseverar em objetivos importantes\n• Manter-se firme em princípios\n• Não desistir facilmente", color: "#D35400" },
    { name: "Fraternidade", shortDesc: "Reconhecer a unidade", description: "Tratar os outros como irmãos na jornada humana.", practices: "• Ver a humanidade comum em todos\n• Ajudar sem distinção\n• Cultivar sentimento de união", color: "#27AE60" }
  ];

  const philosophicalQuotes = [
    { text: "Que ninguém hesite em se dedicar à filosofia enquanto jovem, nem se canse de fazê-lo depois de velho", author: "Epicuro" },
    { text: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis", author: "Sêneca" },
    { text: "A felicidade não consiste em adquirir e gozar, mas em não desejar nada", author: "Epicteto" },
    { text: "Conhece-te a ti mesmo e conhecerás o universo e os deuses", author: "Oráculo de Delfos" },
    { text: "O homem é feito pela sua crença. Como ele acredita, assim ele é", author: "Bhagavad Gita" },
    { text: "Não há religião superior à verdade", author: "H. P. Blavatsky" },
    { text: "A mente é tudo. O que você pensa, você se torna", author: "Buda" },
    { text: "O maior domínio é o domínio de si mesmo", author: "Sêneca" },
    { text: "A vida não examinada não vale a pena ser vivida", author: "Sócrates" }
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
    setCustomVirtue('');
    setDailyIntention('');
    setMorningChallenges('');
    setMorningVehicles('');
    setWhereIFailed('');
    setWhatIDidWell('');
    setWhatILeftUndone('');
    setYearGoals('');
    setLifeGoals('');
    setFvLastCartaDate('');
    setFvNextCartaDate('');
    setFvGdveReuniao('');
    setFvGdveBastiaoName('');
    setFvGdveBastiaoLink('');
    setFvUnlocked(false);
    setLastDrawDate(null);
    setSelectedDate(getTodayKey()); 
    setFvDaily({
      item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
      horasGuarda: '', horasAula: '', gdveTasksStatus: {}, gdveAttendance: false,
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
    
    if (activePracticeId === 'tratack' && practicePhase === 'practice') {
      timer = setTimeout(() => setPracticePhase('done'), 180000); 
      mouseSafetyTimer = setTimeout(() => setTratakMouseActive(true), 2000);
    } else {
      setTratakMouseActive(false); 
    }
    
    return () => { clearTimeout(timer); clearTimeout(mouseSafetyTimer); };
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
          horasGuarda: '', horasAula: '', gdveTasksStatus: {}, gdveAttendance: false,
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
          horasGuarda: '', horasAula: '', gdveTasksStatus: {}, gdveAttendance: false,
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
        setYearGoals(data.yearGoals || '');
        setLifeGoals(data.lifeGoals || '');
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
            setAiGuarda(null); setAiConquistas(null); setAiInvestigacoes(null);
          } else {
            setTechnicalSynthesis(data.technicalSynthesis);
            setAiGuarda(data.aiGuarda || null);
            setAiConquistas(data.aiConquistas || null);
            setAiInvestigacoes(data.aiInvestigacoes || null);
          }
        } else {
          setTechnicalSynthesis(data.technicalSynthesis || null);
          setAiGuarda(data.aiGuarda || null);
          setAiConquistas(data.aiConquistas || null);
          setAiInvestigacoes(data.aiInvestigacoes || null);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados da nuvem:", error);
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

  const saveLongTermGoals = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'longTermGoals', user.uid), { yearGoals, lifeGoals, updatedAt: Timestamp.now() });
        setShowGoalsEditor(false); alert('✅ Metas salvas com sucesso!');
      } catch (error) { alert('Erro ao salvar metas.'); }
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

      // 3. O Prompt JSON
      const prompt = `Você é um Analista de Dados. Retorne ESTRITAMENTE um objeto JSON válido (sem formatação Markdown e sem blocos de código).
      
      REGRAS DE CONTEÚDO:
      - NÃO dê conselhos morais. Aja como um auditor imparcial.
      - Cruze os dados de preenchimento prático (Métricas) com as ocorrências de texto.

      O JSON deve conter EXATAMENTE as seguintes chaves:
      "metricas": Uma síntese técnica comparando as "Práticas FV" e os "Preenchimentos" do Ciclo Atual com o Anterior (máximo 3 linhas).
      "auditoria": O cruzamento dos padrões de Acertos vs Erros e como as práticas FV impactam a rotina (máximo 3 linhas).
      "lexical": A varredura dos Itens FV e Texto Livre. Isole padrões de causalidade e hipóteses (máximo 4 linhas).
      "sinteseGeral": Um relatório final de 2 parágrafos com a conclusão e 2 perguntas técnicas para o encontro com ${termoMestre}.

      DADOS:
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
      alert("Erro ao gerar síntese estruturada."); 
    } finally { 
      setIsGeneratingSynthesis(false); 
    }
  };

  const generateDiscipularSynthesis = async () => {
    if (!user) return;
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
      
      // 2. Monta o Dossiê Estatístico Profundo (Força Viva)
      let dossie = `DADOS ESTATÍSTICOS DO DISCIPULADO (FORÇA VIVA):\n\n`;
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
      headers.push('FV: 1-Varrer', 'FV: 2-Matéria', 'FV: 3e4-Trabalho', 'FV: 5-Tempo', 'FV: 6-Vícios', 'FV: 7-Virtudes', 'FV: Horas Guarda', 'FV: Horas Aula', 'FV: Práticas Realizadas');
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
          fv.item6 || '', fv.item7 || '', fv.horasGuarda || '', fv.horasAula || '', praticasText
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
    
    let txtContent = `====================================================\n`;
    txtContent += `    RELATÓRIO DE PREPARAÇÃO - CARTA DE DEGRAU\n`;
    txtContent += `    Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n`;
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
          
          if (fv.horasGuarda || fv.horasAula) {
            txtContent += `[Registro de Horas]\nHoras-Guarda: ${fv.horasGuarda || '--'} | Horas-Aula: ${fv.horasAula || '--'}\n\n`;
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
        alert('✅ Horários de lembrete atualizados com sucesso!');
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

              

              <button onClick={() => setView('today')} style={{ padding: '0.5rem 1rem', background: view === 'today' ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: view === 'today' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Hoje</button>
              <button onClick={() => setView('history')} style={{ padding: '0.5rem 1rem', background: view === 'history' ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: view === 'history' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Histórico</button>
              <button onClick={() => setView('tasks')} style={{ padding: '0.5rem 1rem', background: view === 'tasks' ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: view === 'tasks' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Tarefas</button>
              <button onClick={() => setView('goals')} style={{ padding: '0.5rem 1rem', background: view === 'goals' ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: view === 'goals' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Metas</button>
              <button onClick={() => setView('biblioteca')} style={{ padding: '0.5rem 1rem', background: view === 'biblioteca' ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: view === 'biblioteca' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Virtudes</button>
              <button onClick={() => setView('analytics')} style={{ padding: '0.5rem 1rem', background: view === 'analytics' ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: view === 'analytics' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#6b4423'), border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={16} /> Métricas
              </button>


              {/* ATALHO RÁPIDO DO TRATAK (GLOBAL) */}
              <button onClick={() => { setActivePracticeId('tratack'); setPracticePhase('intro'); setIsPracticeActive(true); }} style={{ padding: '0.5rem 1rem', background: isDark ? '#b8a88a' : '#8b7355', color: isDark ? '#1a1a2e' : '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                <Target size={16} /> Tratak
              </button>

              {fvUnlocked && (
                <button onClick={handleFvTabClick} style={{ padding: '0.5rem 1rem', background: view === 'fv' ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 'transparent', color: view === 'fv' ? '#000' : '#FFD700', border: '2px solid #FFD700', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>FV</button>
              )}
              
              <button onClick={toggleNotifications} title={notificationsActive ? "Lembretes Ativados" : "Ativar Lembretes"} style={{ position: 'relative', padding: '0.5rem', background: notificationsActive ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : 'transparent', border: `2px solid ${notificationsActive ? '#4caf50' : (isDark ? '#d4af37' : '#6b4423')}`, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={20} color={notificationsActive ? '#4caf50' : (isDark ? '#d4af37' : '#6b4423')} />
                {notificationsActive && <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#4caf50', borderRadius: '50%', padding: '2px', border: `2px solid ${isDark ? '#1a1a2e' : '#f0e6d2'}` }}><Check size={12} color="white" strokeWidth={4} /></div>}
              </button>

              <button onClick={() => setShowSuggestionModal(true)} style={{ padding: '0.5rem', background: 'transparent', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Enviar Sugestão">
                <MessageSquare size={20} color={isDark ? '#d4af37' : '#6b4423'} />
              </button>

              {/* BOTÃO DA ENGRENAGEM AQUI NO TOPO */}
              <button onClick={() => setShowSettingsModal(true)} style={{ padding: '0.5rem', background: 'transparent', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }} title="Configurações">
                <Settings size={20} color={isDark ? '#d4af37' : '#6b4423'} />
              </button>

              <button onClick={toggleTheme} style={{ padding: '0.5rem', background: 'transparent', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDark ? <Sun size={20} color="#d4af37" /> : <Moon size={20} color="#8b7355" />}
              </button>
              
              <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogOut size={16} /> <span>Sair</span>
              </button>
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
              {['today', 'history', 'tasks', 'goals', 'biblioteca', 'analytics'].map((item) => {
                const labels = { today: '☀️ Hoje', history: '📚 Histórico', tasks: '📋 Tarefas', goals: '🎯 Metas', biblioteca: '🏛️ Virtudes', analytics: '📊 Métricas' };
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)', borderRadius: '12px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
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

                        {/* CONTEÚDO EXPANDIDO (DESCRIÇÃO E PRÁTICAS) */}
                        {isTodayVirtueExpanded && (
                          <div className="animate-fadeIn" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
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
                        <button key={idx} onClick={() => { if (newTaskWeekDays.includes(idx)) { setNewTaskWeekDays(newTaskWeekDays.filter(d => d !== idx)); } else { setNewTaskWeekDays([...newTaskWeekDays, idx]); } }} style={{ padding: '0.5rem', flex: 1, minWidth: '40px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', background: newTaskWeekDays.includes(idx) ? (isDark ? '#d4af37' : '#6b4423') : 'transparent', color: newTaskWeekDays.includes(idx) ? (isDark ? '#1a1a2e' : 'white') : (isDark ? '#b8a88a' : '#6b4423'), border: `1px solid ${isDark ? '#d4af37' : '#6b4423'}` }}>{day}</button>
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
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>Metas de Longo Prazo</h2>
              </div>
              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>"Amanhã" - Descreva como você deseja ser no futuro</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif" }}>Metas para Este Ano</label>
                  <textarea value={yearGoals} onChange={(e) => setYearGoals(e.target.value)} placeholder="Como você quer estar no final deste ano? Que virtudes quer ter desenvolvido?" rows={6} style={{ width: '100%', padding: '1rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', lineHeight: '1.7' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#d4af37' : '#6b4423', fontFamily: "'Cinzel', serif" }}>Visão de Longo Prazo (Vida)</label>
                  <textarea value={lifeGoals} onChange={(e) => setLifeGoals(e.target.value)} placeholder="Qual é sua visão maior? Que tipo de pessoa você quer ser?" rows={8} style={{ width: '100%', padding: '1rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#6b4423'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', lineHeight: '1.7' }} />
                </div>
                <button onClick={saveLongTermGoals} style={{ padding: '1rem 2rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', alignSelf: 'flex-end' }}><Save size={20} /> Salvar Metas</button>
              </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)', borderRadius: '12px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
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

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Horas-Guarda (HH:mm)</label>
                          <input type="time" value={fvDaily.horasGuarda || ''} onChange={(e) => handleFvDailyTextChange('horasGuarda', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Horas-Aula (HH:mm)</label>
                          <input type="time" value={fvDaily.horasAula || ''} onChange={(e) => handleFvDailyTextChange('horasAula', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                      </div>

                      <button onClick={saveFvTexts} style={{ width: '100%', padding: '1rem', background: 'rgba(74, 144, 226, 0.2)', color: isDark ? '#6cb2eb' : '#2980b9', border: '2px solid #4A90E2', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Mountain size={20} /> Salvar Reflexões e Horas
                      </button>
                    </div>

                    {/* PRÁTICAS DINÂMICAS */}
                    <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                      <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>Práticas</h3>
                      
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

                      {/* RELATÓRIO DISCIPULAR (IA FORÇA VIVA) */}
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
                        <strong>Aviso Ético:</strong> Este relatório utiliza Inteligência Artificial para cruzar seus hábitos e práticas da Força Viva. A máquina apenas organiza o passado; a intuição do Mestre acende o futuro. 
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
                                  onClick={() => submitSynthesisFeedback("Força Viva")} 
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
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '2rem', margin: '0 0 1rem 0' }}>Prática de Tratak</h2>
                    
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
                    
                    <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '2rem', fontWeight: 'bold' }}>⚠️ Para interromper, toque 3 vezes na tela.</p>

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

                    <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '2rem', fontWeight: 'bold' }}>⚠️ Para interromper, toque 3 vezes na tela.</p>

              
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
              </div>

              {/* Botão de Salvar */}
              <button onClick={saveNotificationTimes} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <Save size={20} /> Salvar Horários
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