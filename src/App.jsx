import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sunrise, Sunset, Search, Calendar, Moon, Sun, 
  Sparkles, ChevronRight, LogOut, Shuffle, Plus, X, 
  AlertCircle, Eye, EyeOff, CheckCircle, Download, Upload,
  Target, TrendingUp, Award, FileText, Book, Settings,
  Trash2, Edit, Save, XCircle, Flame, Zap, Shield, Star, Crown, 
  Bell, Check, Music, MessageSquare, Menu, Lock, ChevronDown, ChevronUp, Mountain, Landmark
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

function App() {
  // Estados de Autenticação
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  // Streaks Mod2
  const [mod2DiaryStreak, setMod2DiaryStreak] = useState(0);
  const [mod2TasksStreak, setMod2TasksStreak] = useState(0);

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

  // Estados Módulo 2
  const [mod2Unlocked, setMod2Unlocked] = useState(false);
  const [mod2ClickCount, setMod2ClickCount] = useState(0);
  const [mod2LastDeliveryDate, setMod2LastDeliveryDate] = useState('');
  const [mod2NextDeliveryDate, setMod2NextDeliveryDate] = useState('');
  const [mod2MeetingDate, setMod2MeetingDate] = useState('');
  const [mod2TopicName, setMod2TopicName] = useState(''); 
  const [mod2TopicLink, setMod2TopicLink] = useState(''); 
  const [showQuickMod2, setShowQuickMod2] = useState(false); 
  const [mod2Tasks, setMod2Tasks] = useState([]);
  const [newMod2TaskName, setNewMod2TaskName] = useState('');
  const [editingMod2TaskId, setEditingMod2TaskId] = useState(null);
  const [newMod2TaskTarget, setNewMod2TaskTarget] = useState(1);
  const [newMod2TaskIsCycle, setNewMod2TaskIsCycle] = useState(false);
  const [mod2CycleStatus, setMod2CycleStatus] = useState({});

  const [mod2Daily, setMod2Daily] = useState({
    item1: '', item2: '', item3: '', item4: '', item5: '', item6: '',
    timeLog1: '', timeLog2: '',
    tasksStatus: {}, meetingAttendance: false,
    praticas: { prac1: false, prac2: false, prac3: false, prac4: false, prac5: false, prac6: false, prac7: false, prac8: false, prac9: false }
  });

  const [isPracticeActive, setIsPracticeActive] = useState(false); 
  const [activePracticeId, setActivePracticeId] = useState(null); 
  const [practicePhase, setPracticePhase] = useState('intro'); 
  const [tratakMouseActive, setTratakMouseActive] = useState(false);
  const [temploSelections, setTemploSelections] = useState({ prac6: false, prac7: false, prac8: false, prac9: false });
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const audioRef = useRef(null);


  // --- SISTEMA DE AUTOSAVE DE EMERGÊNCIA ---
  const autoSaveDataRef = useRef({});

  useEffect(() => {
    autoSaveDataRef.current = {
      user, selectedDate, selectedVirtue, customVirtue, showCustomVirtue, dailyIntention,
      whereIFailed, whatIDidWell, whatILeftUndone, freeEpilogue, didMorning,
      morningDone, eveningDone,
      todayTasksStatus, mod2Daily,
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
      mod2Daily: data.mod2Daily || {
        item1: '', item2: '', item3: '', item4: '', item5: '', item6: '',
        timeLog1: '', timeLog2: '', tasksStatus: {}, meetingAttendance: false,
        praticas: { prac1: false, prac2: false, prac3: false, prac4: false, prac5: false, prac6: false, prac7: false, prac8: false, prac9: false }
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
    
    if (key === 'prac1' || key === 'prac4') {
      setActivePracticeId(key); 
      setPracticePhase('intro'); 
      setIsPracticeActive(true); 
    } 
    else if (['prac6', 'prac7', 'prac8', 'prac9'].includes(key)) {
      setActivePracticeId('templo');
      setTemploSelections({
        prac6: mod2Daily.praticas?.prac6 || false,
        prac7: mod2Daily.praticas?.prac7 || false,
        prac8: mod2Daily.praticas?.prac8 || false,
        prac9: mod2Daily.praticas?.prac9 || false
      });
      setPracticePhase('intro'); 
      setIsPracticeActive(true); 
    } 
    else {
      alert('Esta é uma prática de foro íntimo. Por favor, realize-a privadamente e marque a opção "Já Realizado".');
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
    setMod2LastDeliveryDate('');
    setMod2NextDeliveryDate('');
    setMod2MeetingDate('');
    setMod2TopicName('');
    setMod2TopicLink('');
    setMod2Unlocked(false);
    setLastDrawDate(null);
    setSelectedDate(getTodayKey()); 
    setMod2Daily({
      item1: '', item2: '', item3: '', item4: '', item5: '', item6: '',
      timeLog1: '', timeLog2: '', tasksStatus: {}, meetingAttendance: false,
      praticas: { prac1: false, prac2: false, prac3: false, prac4: false, prac5: false, prac6: false, prac7: false, prac8: false, prac9: false }
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
    setMod2ClickCount(prev => prev + 1);
    if (mod2ClickCount >= 6) {
      setMod2Unlocked(true);
      setMod2ClickCount(0);
      alert('🔓 Módulo Avançado desbloqueado na sessão!');
    }
    setTimeout(() => setMod2ClickCount(0), 3000);
  };

  const handleMod2TabClick = () => {
    setView('mod2'); 
  };

  const handleInstantMod2Lock = async () => {
    setMod2Unlocked(false); 
    setView('today'); 
    alert('🔒 Módulo Avançado ocultado com segurança!');
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
    
    if (activePracticeId === 'prac1' && practicePhase === 'practice') {
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
        await loadMod2Data(currentUser.uid);
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
        setMod2Unlocked(false); 

        setMorningTime(data.morningTime || '06:00'); 
        setEveningTime(data.eveningTime || '22:00');
        
        if ('Notification' in window && Notification.permission === 'granted') {
          setNotificationsActive(!!data.fcmToken);
        } else {
          setNotificationsActive(false);
        }
      } else {
        await setDoc(doc(db, 'users', uid), {
          createdAt: Timestamp.now(), theme: 'light', lastDrawDate: null, mod2Unlocked: false
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
        setMod2Daily(data.mod2Daily || {
          item1: '', item2: '', item3: '', item4: '', item5: '', item6: '',
          timeLog1: '', timeLog2: '', tasksStatus: {}, meetingAttendance: false,
          praticas: { prac1: false, prac2: false, prac3: false, prac4: false, prac5: false, prac6: false, prac7: false, prac8: false, prac9: false }
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
        setMod2Daily({
          item1: '', item2: '', item3: '', item4: '', item5: '', item6: '',
          timeLog1: '', timeLog2: '', tasksStatus: {}, meetingAttendance: false,
          praticas: { prac1: false, prac2: false, prac3: false, prac4: false, prac5: false, prac6: false, prac7: false, prac8: false, prac9: false }
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
        const hasMod2Data = data.mod2Daily && (
          data.mod2Daily.item1 || data.mod2Daily.item2 || data.mod2Daily.item3 || data.mod2Daily.item4 || data.mod2Daily.item5 || data.mod2Daily.item6 || 
          (data.mod2Daily.praticas && Object.values(data.mod2Daily.praticas).some(v => v === true))
        );
        
        if (data.morningDone || data.eveningDone || hasMod2Data) { 
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

        let currentMod2DiaryStreak = 0;
        let currentMod2TasksStreak = 0;
        
        const mod2DiaryEntries = loadedEntries.filter(e => e.mod2Daily && (e.mod2Daily.item1 || e.mod2Daily.item2 || e.mod2Daily.item3 || e.mod2Daily.item4 || e.mod2Daily.item5 || e.mod2Daily.item6));
        const mod2TasksEntries = loadedEntries.filter(e => e.mod2Daily && e.mod2Daily.praticas && Object.values(e.mod2Daily.praticas).some(feito => feito === true));

        let dateToCheckMod2Diary = mod2DiaryEntries.some(e => e.date === todayKeyStr) ? todayKeyStr : (mod2DiaryEntries.some(e => e.date === yesterdayKey) ? yesterdayKey : null);
        if (dateToCheckMod2Diary) {
          for (const entry of mod2DiaryEntries) {
            if (entry.date === dateToCheckMod2Diary) {
              currentMod2DiaryStreak++;
              const prevD = new Date(dateToCheckMod2Diary + 'T12:00:00');
              prevD.setDate(prevD.getDate() - 1);
              dateToCheckMod2Diary = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
            } else if (entry.date < dateToCheckMod2Diary) { break; }
          }
        }
        
        let dateToCheckMod2Tasks = mod2TasksEntries.some(e => e.date === todayKeyStr) ? todayKeyStr : (mod2TasksEntries.some(e => e.date === yesterdayKey) ? yesterdayKey : null);
        if (dateToCheckMod2Tasks) {
          for (const entry of mod2TasksEntries) {
            if (entry.date === dateToCheckMod2Tasks) {
              currentMod2TasksStreak++;
              const prevD = new Date(dateToCheckMod2Tasks + 'T12:00:00');
              prevD.setDate(prevD.getDate() - 1);
              dateToCheckMod2Tasks = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
            } else if (entry.date < dateToCheckMod2Tasks) { break; }
          }
        }
        
        setMod2DiaryStreak(currentMod2DiaryStreak);
        setMod2TasksStreak(currentMod2TasksStreak);
      } else {
        setStreak(0);
        setLongestStreak(0);
        setMod2DiaryStreak(0);
        setMod2TasksStreak(0);
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

  const loadMod2Data = async (uid) => {
    try {
      const mod2Doc = await getDoc(doc(db, 'mod2Data', uid));
      if (mod2Doc.exists()) {
        const data = mod2Doc.data();
        setMod2LastDeliveryDate(data.lastDeliveryDate || '');
        setMod2NextDeliveryDate(data.nextDeliveryDate || '');
        setMod2MeetingDate(data.meetingDate || '');
        setMod2TopicName(data.topicName || '');
        setMod2TopicLink(data.topicLink || '');
        setMod2Tasks(data.tasks || []);
        setMod2CycleStatus(data.cycleStatus || {});
      }
    } catch (error) { console.error('Erro ao carregar dados Mod2:', error); }
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

  // --- MÓDULO 2 (AVANÇADO) ---

  const saveMod2TasksToDB = async (tasks) => {
    if (user) {
      try { await setDoc(doc(db, 'mod2Data', user.uid), { tasks: tasks }, { merge: true }); } 
      catch(e) { console.error("Erro", e); }
    }
  };

  const addMod2Task = () => {
    if (!newMod2TaskName.trim()) return;
    const taskData = {
      id: editingMod2TaskId || `mod2_${Date.now()}`, name: newMod2TaskName.trim(),
      target: parseInt(newMod2TaskTarget) || 1, isCycle: newMod2TaskIsCycle
    };
    const newTasks = editingMod2TaskId ? mod2Tasks.map(t => t.id === editingMod2TaskId ? taskData : t) : [...mod2Tasks, taskData];
    setMod2Tasks(newTasks); setNewMod2TaskName(''); setNewMod2TaskTarget(1); setNewMod2TaskIsCycle(false); setEditingMod2TaskId(null);
    saveMod2TasksToDB(newTasks);
  };

  const startEditingMod2Task = (task) => {
    setEditingMod2TaskId(task.id); setNewMod2TaskName(task.name);
    setNewMod2TaskTarget(task.target || 1); setNewMod2TaskIsCycle(task.isCycle || false);
  };

  const removeMod2Task = (id) => {
    const newTasks = mod2Tasks.filter(t => t.id !== id);
    setMod2Tasks(newTasks); saveMod2TasksToDB(newTasks);
  };

  const toggleMod2Task = async (task) => {
    if (task.isCycle) {
      const newStatus = { ...mod2CycleStatus, [task.id]: !mod2CycleStatus[task.id] };
      setMod2CycleStatus(newStatus);
      if (user) await setDoc(doc(db, 'mod2Data', user.uid), { cycleStatus: newStatus }, { merge: true });
    } else {
      let currentVal = mod2Daily.tasksStatus?.[task.id] || 0;
      if (typeof currentVal === 'boolean') currentVal = currentVal ? 1 : 0;
      let newVal = task.target > 1 ? (currentVal + 1 > task.target ? 0 : currentVal + 1) : (currentVal ? 0 : 1);
      const newMod2Daily = { ...mod2Daily, tasksStatus: { ...mod2Daily.tasksStatus, [task.id]: newVal } };
      setMod2Daily(newMod2Daily);
      if (user) {
        await setDoc(doc(db, 'entries', `${user.uid}_${selectedDate}`), { mod2Daily: newMod2Daily }, { merge: true });
        await loadAllEntries(user.uid);
      }
    }
  };

  const registerMod2Attendance = async () => {
    const isAttending = !mod2Daily.meetingAttendance;
    const newMod2Daily = { ...mod2Daily, meetingAttendance: isAttending };
    setMod2Daily(newMod2Daily);
    
    if (isAttending) {
      if (window.confirm("Deseja agendar o próximo encontro para 15 dias após esta data e reiniciar o ciclo?")) {
         const currentDate = new Date(selectedDate + 'T12:00:00');
         currentDate.setDate(currentDate.getDate() + 15);
         let nextHour = '20'; let nextMinute = '00';
         if (mod2MeetingDate && !isNaN(new Date(mod2MeetingDate).getTime())) {
            const prevDate = new Date(mod2MeetingDate);
            nextHour = String(prevDate.getHours()).padStart(2, '0'); nextMinute = String(prevDate.getMinutes()).padStart(2, '0');
         }
         const nextDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}T${nextHour}:${nextMinute}`;
         setMod2MeetingDate(nextDateStr); setMod2CycleStatus({}); 
         if(user) await setDoc(doc(db, 'mod2Data', user.uid), { meetingDate: nextDateStr, cycleStatus: {} }, { merge: true });
      }
    }
    if (user) {
      await setDoc(doc(db, 'entries', `${user.uid}_${selectedDate}`), { mod2Daily: newMod2Daily }, { merge: true });
      await loadAllEntries(user.uid);
    }
  };

  const saveMod2Planning = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'mod2Data', user.uid), {
          lastDeliveryDate: mod2LastDeliveryDate || '',
          nextDeliveryDate: mod2NextDeliveryDate || '',
          meetingDate: mod2MeetingDate || '',
          topicName: mod2TopicName || '',
          topicLink: mod2TopicLink || '',
          updatedAt: Timestamp.now()
        }, { merge: true }); 
        alert('✅ Datas do Planejamento salvas!');
      } catch (error) { console.error(error); alert('Erro ao salvar dados.'); }
    }
  };

  const saveMod2Texts = async () => {
    if (user) {
      const todayKey = selectedDate;
      try {
        const payload = {
          userId: user.uid,
          date: todayKey,
          mod2Daily: mod2Daily, 
          textsTimestamp: Timestamp.now()
        };

        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), payload, { merge: true }); 
        
        await loadAllEntries(user.uid); 
        
        alert('✅ Reflexões salvas com sucesso!');
      } catch (error) { console.error(error); alert('Erro ao salvar os textos.'); }
    }
  };

  const saveMod2Practices = async () => {
    if (user) {
      const todayKey = selectedDate;
      try {
        const payload = {
          userId: user.uid,
          date: todayKey,
          mod2Daily: mod2Daily, 
          practicesTimestamp: Timestamp.now()
        };

        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), payload, { merge: true }); 
        
        await loadAllEntries(user.uid); 
        
        alert('✅ Práticas salvas com sucesso!');
      } catch (error) { console.error(error); alert('Erro ao salvar as práticas.'); }
    }
  };

  const handleMod2DailyTextChange = (key, value) => {
    setMod2Daily(prev => ({ ...prev, [key]: value }));
  };

  const handleMod2DailyPracticeChange = (key, value) => {
    setMod2Daily(prev => ({ ...prev, praticas: { ...prev.praticas, [key]: value } }));
  };

  const confirmImmersivePractice = async (key) => {
    const newMod2Daily = {
      ...mod2Daily,
      praticas: { ...mod2Daily.praticas, [key]: true }
    };
    setMod2Daily(newMod2Daily); 
    setIsPracticeActive(false);
    exitFullScreen();

    if (user) {
      const todayKey = selectedDate;
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          mod2Daily: newMod2Daily
        }, { merge: true });
        await loadAllEntries(user.uid); 
      } catch (error) { console.error("Erro ao salvar prática:", error); }
    }
  };

  const confirmTemploPractice = async () => {
    const newMod2Daily = {
      ...mod2Daily,
      praticas: { ...mod2Daily.praticas, ...temploSelections }
    };
    setMod2Daily(newMod2Daily);
    setIsPracticeActive(false);
    exitFullScreen();

    if (user) {
      const todayKey = selectedDate;
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          mod2Daily: newMod2Daily
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
    
    // Se o modo Mod2 estiver ativado
    if (mod2Unlocked) {
      headers.push('Mod2: Tópico 1', 'Mod2: Tópico 2', 'Mod2: Tópico 3', 'Mod2: Tópico 4', 'Mod2: Tópico 5', 'Mod2: Tópico 6', 'Mod2: Tempo 1', 'Mod2: Tempo 2', 'Mod2: Práticas');
    }

    const rows = entries.map(entry => {
      const row = [
        entry.date, entry.didMorning ? 'Sim' : 'Não', entry.virtue || '', entry.intention || '',
        entry.whereIFailed || '', entry.whatIDidWell || '', entry.whatILeftUndone || ''
      ];

      if (mod2Unlocked) {
        const m2 = entry.mod2Daily || {};
        let praticasText = '';
        
        if (m2.praticas) {
          const m2Labels = { prac1: 'Prática 1', prac2: 'Prática 2', prac3: 'Prática 3', prac4: 'Prática 4', prac6: 'Nível 1', prac7: 'Nível 2', prac8: 'Nível 3', prac9: 'Nível 4' };
          praticasText = Object.entries(m2.praticas).filter(([_, feito]) => feito).map(([key]) => m2Labels[key] || key).join(' + ');
        }

        row.push(
          m2.item1 || '', m2.item2 || '', m2.item3 || '', m2.item4 || '', 
          m2.item5 || '', m2.item6 || '', m2.timeLog1 || '', m2.timeLog2 || '', praticasText
        );
      }
      return row;
    });

    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = mod2Unlocked ? `relatorio-modulo2-${getTodayKey()}.csv` : `diario-filosofico-${getTodayKey()}.csv`; 
    link.click();
  };

  const exportMod2ReportTXT = () => {
    if (entries.length === 0) { alert('Não há entradas para exportar'); return; }
    
    let txtContent = `====================================================\n`;
    txtContent += `    RELATÓRIO - MÓDULO 2\n`;
    txtContent += `    Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n`;
    txtContent += `====================================================\n\n`;
    
    const reversedEntries = [...entries].reverse();
    let hasData = false;

    reversedEntries.forEach(entry => {
      if (entry.mod2Daily) {
        const m2 = entry.mod2Daily;
        const hasTextData = m2.item1 || m2.item2 || m2.item3 || m2.item4 || m2.item5 || m2.item6;
        
        if (hasTextData) {
          hasData = true;
          txtContent += `----------------------------------------------------\n`;
          txtContent += `DATA: ${new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}\n`;
          txtContent += `----------------------------------------------------\n`;
          
          if (m2.item1) txtContent += `[1] Tópico 1:\n${m2.item1}\n\n`;
          if (m2.item2) txtContent += `[2] Tópico 2:\n${m2.item2}\n\n`;
          if (m2.item3) txtContent += `[3] Tópico 3:\n${m2.item3}\n\n`;
          if (m2.item4) txtContent += `[4] Tópico 4:\n${m2.item4}\n\n`;
          if (m2.item5) txtContent += `[5] Tópico 5:\n${m2.item5}\n\n`;
          if (m2.item6) txtContent += `[6] Tópico 6:\n${m2.item6}\n\n`;
          
          if (m2.timeLog1 || m2.timeLog2) {
            txtContent += `[Registro de Tempo]\nTempo 1: ${m2.timeLog1 || '--'} | Tempo 2: ${m2.timeLog2 || '--'}\n\n`;
          }
          txtContent += `\n\n`;
        }
      }
    });

    if (!hasData) {
      alert('Você ainda não tem textos preenchidos no Módulo 2 para gerar o relatório.');
      return;
    }

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `Borracha_Modulo2_${getTodayKey()}.txt`; 
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
    if (user && mod2Unlocked) {
      try { await updateDoc(doc(db, 'users', user.uid), { mod2Unlocked: false }); } catch(err) {}
    }
    setMod2Unlocked(false); 
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

              {/* ATALHO RÁPIDO DO TRATAK (GLOBAL) */}
              <button onClick={() => { setActivePracticeId('tratack'); setPracticePhase('intro'); setIsPracticeActive(true); }} style={{ padding: '0.5rem 1rem', background: isDark ? '#b8a88a' : '#8b7355', color: isDark ? '#1a1a2e' : '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                <Target size={16} /> Tratak
              </button>

              {mod2Unlocked && (
                <button onClick={handleMod2TabClick} style={{ padding: '0.5rem 1rem', background: view === 'mod2' ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 'transparent', color: view === 'mod2' ? '#000' : '#FFD700', border: '2px solid #FFD700', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>Mod 2</button>
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
              {['today', 'history', 'tasks', 'goals', 'biblioteca'].map((item) => {
                const labels = { today: '☀️ Hoje', history: '📚 Histórico', tasks: '📋 Tarefas', goals: '🎯 Metas', biblioteca: '🏛️ Virtudes' };
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
              
              {mod2Unlocked && (
                <button onClick={() => { setView('mod2'); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1.2rem', textAlign: 'left', background: view === 'mod2' ? 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%)' : 'transparent', color: view === 'mod2' ? '#FFD700' : (isDark ? '#f0e6d2' : '#2c1810'), border: `1px solid ${view === 'mod2' ? '#FFD700' : 'transparent'}`, borderRadius: '12px', fontSize: '1.3rem', fontFamily: 'Georgia, serif', fontWeight: view === 'mod2' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Award size={24} color="#FFD700" /> Módulo 2
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

        {/* VIEW: MOD2 */}
        {view === 'mod2' && mod2Unlocked && (
          <div className="animate-fadeIn">
            {!fvVault ? (
              <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.9)' : 'white', padding: '3rem 2rem', borderRadius: '16px', border: `2px dashed ${isDark ? '#FFD700' : '#996515'}`, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                <Lock size={48} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1rem' }} />
                <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', marginBottom: '1rem' }}>Cofre Selado</h2>
                <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem' }}>A sua configuração de banco de dados não foi encontrada. Cole o JSON fornecido no campo abaixo para iniciar o cofre.</p>
                <textarea value={vaultInput} onChange={(e) => setVaultInput(e.target.value)} rows={6} style={{ width: '100%', padding: '1rem', background: isDark ? '#000' : '#f0f0f0', border: '1px solid #ccc', borderRadius: '8px', color: isDark ? '#0f0' : '#333', fontFamily: 'monospace', marginBottom: '1.5rem' }} placeholder='{ "modTitle": "..." }'></textarea>
                <button onClick={saveVaultData} style={{ padding: '1rem 2rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '1.1rem' }}>Inicializar Cofre</button>
              </div>
            ) : (
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
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Award size={32} color="#FFD700" />
                      <div>
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>Registro Diário | M2</h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem' }}>Dia: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: mod2DiaryStreak > 0 ? 'rgba(74, 144, 226, 0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'), border: `1px solid ${mod2DiaryStreak > 0 ? '#4A90E2' : (isDark ? '#555' : '#ccc')}`, borderRadius: '20px', color: mod2DiaryStreak > 0 ? '#4A90E2' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold' }}>
                        <Mountain size={18} /> {mod2DiaryStreak}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: mod2TasksStreak > 0 ? 'rgba(155, 89, 182, 0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'), border: `1px solid ${mod2TasksStreak > 0 ? '#9B59B6' : (isDark ? '#555' : '#ccc')}`, borderRadius: '20px', color: mod2TasksStreak > 0 ? '#9B59B6' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold' }}>
                        <Landmark size={18} /> {mod2TasksStreak}
                      </div>
                      <button onClick={handleInstantMod2Lock} style={{ padding: '0.5rem', background: 'transparent', color: '#e74c3c', border: 'none', cursor: 'pointer' }}><Lock size={22} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '1rem' }}>
                    <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                      <h3 style={{ margin: '0 0 1.5rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>Reflexões</h3>
                      
                      {fvVault?.carta?.map(item => (
                        <div key={item.id} style={{ marginBottom: '1.5rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>{item.title}</label>
                          <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.75rem', fontStyle: 'italic' }}>{item.desc}</p>
                          <textarea value={mod2Daily[item.id] || ''} onChange={(e) => handleMod2DailyTextChange(item.id, e.target.value)} rows={3} style={{ width: '100%', padding: '1rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                        </div>
                      ))}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Tempo 1 (HH:mm)</label>
                          <input type="time" value={mod2Daily.timeLog1 || ''} onChange={(e) => handleMod2DailyTextChange('timeLog1', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Tempo 2 (HH:mm)</label>
                          <input type="time" value={mod2Daily.timeLog2 || ''} onChange={(e) => handleMod2DailyTextChange('timeLog2', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                        </div>
                      </div>

                      <button onClick={saveMod2Texts} style={{ width: '100%', padding: '1rem', background: 'rgba(74, 144, 226, 0.2)', color: isDark ? '#6cb2eb' : '#2980b9', border: '2px solid #4A90E2', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Mountain size={20} /> Salvar Reflexões
                      </button>
                    </div>

                    <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                      <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>Práticas</h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                          {fvVault?.praticas?.map(prac => (
                            <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: mod2Daily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'), border: `1px solid ${mod2Daily.praticas?.[prac.key] ? '#4caf50' : (isDark ? 'rgba(212, 175, 55, 0.3)' : '#ccc')}`, borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                              {mod2Daily.praticas?.[prac.key] ? <CheckCircle size={18} color="#4caf50" /> : <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${isDark ? '#b8a88a' : '#999'}` }}></div>}
                              <span style={{ color: mod2Daily.praticas?.[prac.key] ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '0.95rem', fontWeight: mod2Daily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #FFD700' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1rem' }}>Avançadas</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            {fvVault?.templo?.map(prac => (
                              <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.6rem', background: mod2Daily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : 'transparent', border: `1px solid ${mod2Daily.praticas?.[prac.key] ? '#4caf50' : 'transparent'}`, borderRadius: '8px', transition: 'all 0.2s' }}>
                                {mod2Daily.praticas?.[prac.key] ? <CheckCircle size={16} color="#4caf50" /> : <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${isDark ? '#b8a88a' : '#999'}` }}></div>}
                                <span style={{ color: mod2Daily.praticas?.[prac.key] ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#c8b896' : '#6b5744'), fontSize: '0.9rem', fontWeight: mod2Daily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button onClick={saveMod2Practices} style={{ width: '100%', padding: '1rem', background: 'rgba(155, 89, 182, 0.2)', color: isDark ? '#c39bd3' : '#8e44ad', border: '2px solid #9B59B6', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Landmark size={20} /> Salvar Práticas
                      </button>
                    </div>
                  </div>

                  <div style={{ height: '2px', background: 'rgba(255,215,0,0.3)', margin: '3rem 0 2rem' }}></div>

                  {/* MÓDULO 2 (GENÉRICO) */}
                  <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.2)', marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.2rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Star size={24} /> {fvVault?.modTitle}
                    </h3>
                    
                    <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', padding: '1rem', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1rem' }}>{fvVault?.readingTitle}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#b8a88a' : '#6b5744' }}>{fvVault?.selectLabel}</label>
                          <select value={mod2TopicName} onChange={(e) => { const val = e.target.value; setMod2TopicName(val); const found = fvVault.db.find(b => b.name === val); if (found) setMod2TopicLink(found.link); else if (val !== 'Outro') setMod2TopicLink(''); }} style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                            <option value="">Selecione na lista...</option>
                            {fvVault?.db?.map((b, idx) => (<option key={idx} value={b.name}>{b.name}</option>))}
                            <option value="Outro">Outro (Inserir Manualmente)</option>
                          </select>
                        </div>
                        {mod2TopicName === 'Outro' && (
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#b8a88a' : '#6b5744' }}>Link do PDF (Manual)</label>
                            <input type="url" value={mod2TopicLink} onChange={(e) => setMod2TopicLink(e.target.value)} placeholder="Cole o link aqui..." style={{ width: '100%', padding: '0.75rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                          </div>
                        )}
                      </div>
                      {mod2TopicLink && (
                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <a href={mod2TopicLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transition: 'all 0.2s' }}>
                            <BookOpen size={18} /> Acessar Leitura
                          </a>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '1rem', background: mod2Daily.meetingAttendance ? (isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9') : (isDark ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0'), borderRadius: '8px', border: `1px solid ${mod2Daily.meetingAttendance ? '#4caf50' : (isDark ? 'rgba(255, 152, 0, 0.3)' : '#ffb74d')}`, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: mod2Daily.meetingAttendance ? '#4caf50' : (isDark ? '#ffb74d' : '#e65100'), fontSize: '1.05rem' }}>{fvVault?.meetingTitle || 'Reunião'}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744' }}>{fvVault?.meetingDesc || 'Registrar participação.'}</p>
                      </div>
                      <button onClick={registerMod2Attendance} style={{ padding: '0.75rem 1.5rem', background: mod2Daily.meetingAttendance ? '#4caf50' : 'transparent', color: mod2Daily.meetingAttendance ? '#fff' : (isDark ? '#ffb74d' : '#e65100'), border: `2px solid ${mod2Daily.meetingAttendance ? '#4caf50' : (isDark ? '#ffb74d' : '#e65100')}`, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                        {mod2Daily.meetingAttendance ? <><CheckCircle size={18} /> Participação Confirmada</> : 'Marcar Participação nesta data'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, color: isDark ? '#d4af37' : '#6b4423', fontSize: '1rem' }}>{fvVault?.tasksTitle || 'Práticas Específicas'}</h4>
                    </div>
                    
                    <div style={{ padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '8px', border: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input type="text" value={newMod2TaskName} onChange={(e) => setNewMod2TaskName(e.target.value)} placeholder={fvVault?.taskPlaceholder || "Nova prática..."} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>
                          <input type="checkbox" checked={newMod2TaskIsCycle} onChange={(e) => { setNewMod2TaskIsCycle(e.target.checked); if(e.target.checked) setNewMod2TaskTarget(1); }} style={{ width: '18px', height: '18px', accentColor: '#d4af37' }} />
                          <span>Missão de Ciclo (Não zera por dia)</span>
                        </label>
                        {!newMod2TaskIsCycle && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>
                            <span>Vezes por dia:</span>
                            <input type="number" min="1" max="100" value={newMod2TaskTarget} onChange={(e) => setNewMod2TaskTarget(e.target.value)} style={{ width: '60px', padding: '0.4rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#ccc'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                          </div>
                        )}
                        <button onClick={addMod2Task} style={{ marginLeft: 'auto', padding: '0.6rem 1.2rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                          {editingMod2TaskId ? 'Salvar Edição' : 'Adicionar'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {mod2Tasks.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>Nenhuma tarefa cadastrada.</p>
                      ) : (
                        mod2Tasks.map(task => {
                          const isCycle = task.isCycle;
                          const isCounter = !isCycle && task.target > 1;
                          let isCompleted = false;
                          let displayValue = '';

                          const currentCount = (typeof mod2Daily.tasksStatus?.[task.id] === 'boolean' ? (mod2Daily.tasksStatus[task.id] ? 1 : 0) : mod2Daily.tasksStatus?.[task.id]) || 0;
                          const targetCount = task.target || 1;
                          const taskColor = getTaskColor(currentCount, targetCount, isDark);

                          if (isCycle) {
                             isCompleted = !!mod2CycleStatus[task.id];
                             displayValue = isCompleted ? 'Feito' : 'Pendente';
                          } else if (isCounter) {
                             isCompleted = currentCount >= targetCount;
                             displayValue = `${currentCount}/${targetCount}`;
                          } else {
                             isCompleted = !!mod2Daily.tasksStatus?.[task.id];
                          }

                          return (
                            <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)', borderRadius: '8px', border: `2px solid ${taskColor}`, transition: 'all 0.3s ease' }}>
                              <div onClick={() => toggleMod2Task(task)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
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
                                <button onClick={() => startEditingMod2Task(task)} style={{ background: 'transparent', border: 'none', color: isDark ? '#d4af37' : '#6b4423', cursor: 'pointer', display: 'flex' }}><Edit size={18} /></button>
                                <button onClick={() => { if(window.confirm(`Excluir a tarefa "${task.name}"?`)) removeMod2Task(task.id); }} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', display: 'flex' }}><Trash2 size={18} /></button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <h3 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '1.4rem', fontFamily: "'Cinzel', serif" }}>Planejamento de Datas</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Última Entrega</label>
                        <input type="date" value={mod2LastDeliveryDate || ''} onChange={(e) => { const novaData = e.target.value; setMod2LastDeliveryDate(novaData); if (novaData) { const [ano, mes, dia] = novaData.split('-'); const dataCalculada = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1 + 3, parseInt(dia, 10)); setMod2NextDeliveryDate(`${dataCalculada.getFullYear()}-${String(dataCalculada.getMonth() + 1).padStart(2, '0')}-${String(dataCalculada.getDate()).padStart(2, '0')}`); } else { setMod2NextDeliveryDate(''); } }} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Próxima Entrega Prevista</label>
                        <input type="date" value={mod2NextDeliveryDate || ''} onChange={(e) => setMod2NextDeliveryDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>Próximo Encontro (Módulo 2)</label>
                      <input type="datetime-local" value={mod2MeetingDate || ''} onChange={(e) => setMod2MeetingDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                    
                    <button onClick={saveMod2Planning} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: isDark ? '#FFD700' : '#996515', border: '2px solid #FFD700', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}>
                      <Save size={18} /> Salvar Datas de Planejamento
                    </button>
                  </div>
                </div>
              </>
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
                {mod2Unlocked && (
                  <button onClick={exportMod2ReportTXT} disabled={entries.length === 0} style={{ padding: '0.75rem 1.5rem', background: entries.length > 0 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : '#ccc', color: '#000', border: 'none', borderRadius: '8px', cursor: entries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: entries.length > 0 ? '0 4px 12px rgba(255,215,0,0.2)' : 'none' }}>
                    <FileText size={18} /> Relatório M2 (TXT)
                  </button>
                )}
                <label style={{ padding: '0.75rem 1.5rem', background: isDark ? '#d4af37' : '#6b4423', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={18} /> Importar
                  <input type="file" accept=".csv,.json,.txt" onChange={importDiary} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {mod2Unlocked && (mod2LastDeliveryDate || mod2MeetingDate) && (
              <div className="animate-fadeIn" style={{ background: isDark ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, rgba(255, 165, 0, 0.05) 100%)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.3)' : '#ffe082'}`, marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#ffd700' : '#d4af37', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}><Award size={20} /> Planejamento do Módulo 2</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {mod2LastDeliveryDate && (<div><span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block' }}>Última Entrega:</span><strong style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>{new Date(mod2LastDeliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>)}
                  {mod2NextDeliveryDate && (<div><span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block' }}>Próxima Entrega:</span><strong style={{ color: '#e74c3c' }}>{new Date(mod2NextDeliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>)}
                  {mod2MeetingDate && (<div><span style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', display: 'block' }}>Próx. Encontro:</span><strong style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>{new Date(mod2MeetingDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></div>)}
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
                  const todayObj = new Date();
                  const currentYearStr = todayObj.getFullYear().toString();
                  const currentMonthStr = todayObj.toLocaleDateString('pt-BR', { month: 'long' });
                  const currentMonthKey = `${currentMonthStr.charAt(0).toUpperCase() + currentMonthStr.slice(1)} ${currentYearStr}`;

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

                  return groupedEntries.map((yearGroup) => {
                    const isYearExpanded = expandedYears[yearGroup.year] !== undefined ? expandedYears[yearGroup.year] : (yearGroup.year === currentYearStr);

                    return (
                      <div key={yearGroup.year} style={{ background: isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(240, 230, 210, 0.4)', borderRadius: '16px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, overflow: 'hidden' }}>
                        
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

                        {isYearExpanded && (
                          <div className="animate-fadeIn" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {yearGroup.months.map((monthGroup) => {
                              const isMonthExpanded = expandedMonths[monthGroup.monthKey] !== undefined ? expandedMonths[monthGroup.monthKey] : (monthGroup.monthKey === currentMonthKey);

                              return (
                                <div key={monthGroup.monthKey} style={{ marginBottom: '0.5rem' }}>
                                  
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

                                  {isMonthExpanded && (
                                    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', paddingLeft: '0.5rem', borderLeft: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                                      {monthGroup.entries.map((entry) => {
                                        const isExpanded = expandedEntryId === entry.id;
                                        const isPartial = entry.morningDone && !entry.eveningDone;

                                        return (
                                          <div key={entry.id} style={{ background: isPartial ? (isDark ? 'rgba(40, 25, 10, 0.6)' : '#fffdf5') : (isDark ? 'rgba(26, 26, 46, 0.6)' : 'white'), padding: '1.5rem', borderRadius: '12px', border: `2px solid ${isPartial ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)')}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
                                            
                                            <div onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                              <div>
                                                <h3 style={{ margin: 0, color: isPartial ? (isDark ? '#ffb74d' : '#e65100') : (isDark ? '#d4af37' : '#6b4423'), fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                                  {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </h3>
                                                
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                  {entry.virtue && <span style={{ padding: '0.2rem 0.6rem', background: isDark ? 'rgba(212,175,55,0.2)' : '#fdf5e6', borderRadius: '4px', fontSize: '0.85rem', color: isDark ? '#d4af37' : '#6b4423', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : '#e8dcc4'}` }}>Virtude: <strong>{entry.virtue}</strong></span>}

                                                  {!entry.didMorning && <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,152,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)' }}>⚠️ Sem Prólogo</span>}
  
                                                  {isPartial && <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,152,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)' }}>⏳ Epílogo Pendente</span>}
  
                                                  {entry.mod2Daily && mod2Unlocked && (
                                                    <span style={{ padding: '0.2rem 0.6rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', borderRadius: '4px', fontSize: '0.85rem', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 4px rgba(255,215,0,0.2)' }}>
                                                      <Award size={12} /> Mod 2
                                                    </span>
                                                  )}

                                                  {entry.mod2Daily && entry.mod2Daily.meetingAttendance && mod2Unlocked && (
                                                    <span style={{ padding: '0.2rem 0.6rem', background: 'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)', borderRadius: '4px', fontSize: '0.85rem', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 4px rgba(155,89,182,0.3)' }}>
                                                      <Star size={12} /> Reunião
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

                                                {entry.mod2Daily && entry.mod2Daily.praticas && mod2Unlocked && (
                                                  <div style={{ padding: '1rem', background: isDark ? 'rgba(255, 215, 0, 0.05)' : '#fffbf0', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#FFD700' : '#996515'}`, marginBottom: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                      <Award size={16} /> Práticas M2 Realizadas:
                                                    </h4>
                                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#c8b896' : '#6b5744', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                                      {(() => {
                                                        const praticasFeitas = Object.entries(entry.mod2Daily.praticas).filter(([_, feito]) => feito).map(([key]) => key);
                                                        if (praticasFeitas.length === 0) return <li style={{ fontStyle: 'italic', opacity: 0.7, listStyle: 'none', marginLeft: '-1.2rem' }}>Apenas os registros escritos foram salvos.</li>;

                                                        const dicionarioGeral = { prac1: 'Prática 1', prac2: 'Prática 2', prac3: 'Prática 3', prac4: 'Prática 4' };
                                                        const dicionarioTemplo = { prac6: 'Nível 1', prac7: 'Nível 2', prac8: 'Nível 3', prac9: 'Nível 4' };
                                                        const listaGeral = praticasFeitas.filter(key => dicionarioGeral[key]);
                                                        const listaTemplo = ['prac6', 'prac7', 'prac8', 'prac9'].filter(key => praticasFeitas.includes(key));

                                                        return (
                                                          <>
                                                            {listaGeral.map(key => <li key={key}><strong>{dicionarioGeral[key]}</strong></li>)}
                                                            {listaTemplo.length > 0 && (<li key="templo-grupo"><strong>Avançadas: {listaTemplo.map(k => dicionarioTemplo[k]).join(', ')}</strong></li>)}
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
                
                <button onClick={() => { handleMod2DailyPracticeChange(activeActionMenu.key, true); setActiveActionMenu(null); }} style={{ width: '100%', padding: '1rem', background: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9', color: isDark ? '#81c784' : '#2e7d32', border: `2px solid ${isDark ? '#4caf50' : '#4caf50'}`, borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} /> Já Realizado
                </button>

                {/* Se já estiver marcado, dá a opção de desmarcar */}
                {mod2Daily.praticas?.[activeActionMenu.key] && (
                  <button onClick={() => { handleMod2DailyPracticeChange(activeActionMenu.key, false); setActiveActionMenu(null); }} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: isDark ? '#b8a88a' : '#6b5744', border: 'none', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}>
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
            {activePracticeId === 'prac1' && (
              <>
                {/* FASE 1: INSTRUÇÃO */}
                {practicePhase === 'intro' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '500px' }}>
                    <Target size={48} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '2rem', margin: '0 0 1rem 0' }}>Prática de Foco</h2>
                    
                    <div style={{ background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(153,101,21,0.05)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', margin: 0 }}>Posicione o seu dispositivo a cerca de 1 metro de distância, alinhado à altura dos olhos.</p>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', marginTop: '1rem', marginBottom: 0 }}>Sente-se adequadamente, com a coluna ereta. Respire fundo e clique em iniciar.</p>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.5rem', fontStyle: 'italic' }}>A prática durará 3 minutos. Mantenha o olhar fixo no ponto central.</p>
                    
                    <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '2rem', fontWeight: 'bold' }}>⚠️ Para encerrar antecipadamente, mova o mouse.</p>

                    <button 
                      onClick={() => { 
                        setPracticePhase('practice'); 
                        setCancelClickCount(0); 
                        enterFullScreen();
                      }} 
                      style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                    >
                      Iniciar Prática
                    </button>
                    <button onClick={() => setIsPracticeActive(false)} style={{ marginTop: '1rem', display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#888' : '#6b5744', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>Voltar ao Diário</button>
                  </div>
                )}

                {/* FASE 2: O CÍRCULO */}
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
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '2.5rem', marginBottom: '1rem' }}>Prática Realizada</h2>
                    <p style={{ fontSize: '1.2rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2.5rem' }}>O foco e a disciplina foram forjados mais um pouco hoje.</p>
                    <button 
                      onClick={() => confirmImmersivePractice('prac1')} 
                      style={{ padding: '1rem 3rem', fontSize: '1.2rem', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                    >
                      Confirmar Prática
                    </button>
                  </div>
                )}
              </>
            )}


            <audio 
              ref={audioRef} 
              src={activePracticeId === 'templo' ? "/beethoven.mp3" : "/aria-bach.mp3"} 
              onEnded={() => setPracticePhase('done')}
            />

            {/* --- 2. PRÁTICA 4 --- */}
            {activePracticeId === 'prac4' && (
              <>
                {/* FASE 1: INSTRUÇÃO */}
                {practicePhase === 'intro' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '500px' }}>
                    <Music size={48} color={isDark ? '#81c784' : '#2e7d32'} style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#81c784' : '#2e7d32', fontSize: '2rem', margin: '0 0 1rem 0' }}>Prática de Serenidade</h2>
                    
                    <div style={{ background: isDark ? 'rgba(76, 175, 80, 0.05)' : 'rgba(76, 175, 80, 0.1)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.3)'}`, marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', margin: 0 }}>Sente-se de forma confortável, feche os olhos e respire profundamente.</p>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', marginTop: '1rem', marginBottom: 0 }}>Ao iniciar, a melodia começará a tocar. Deixe a música lavar seus pensamentos.</p>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.5rem', fontStyle: 'italic' }}>A prática terminará automaticamente ao fim da melodia (~5 min).</p>
                    
                    <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '2rem', fontWeight: 'bold' }}>⚠️ Para interromper, toque 3 vezes na tela.</p>

                    <button 
                      onClick={() => { 
                        setPracticePhase('practice'); 
                        setCancelClickCount(0); 
                        enterFullScreen();
                        if(audioRef.current) audioRef.current.play();
                      }} 
                      style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', background: 'linear-gradient(135deg, #81c784 0%, #4caf50 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)' }}
                    >
                      Iniciar Prática
                    </button>
                    <button onClick={() => setIsPracticeActive(false)} style={{ marginTop: '1rem', display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#888' : '#6b5744', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>Voltar ao Diário</button>
                  </div>
                )}

                {/* FASE 2: A PRÁTICA */}
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
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '2.5rem', marginBottom: '1rem' }}>Prática Concluída</h2>
                    <p style={{ fontSize: '1.2rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2.5rem' }}>Sua mente agora está serena e limpa como um espelho d'água.</p>
                    <button 
                      onClick={() => confirmImmersivePractice('prac4')} 
                      style={{ padding: '1rem 3rem', fontSize: '1.2rem', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                    >
                      Confirmar Prática
                    </button>
                  </div>
                )}
              </>
            )}

            {/* --- 3. PRÁTICAS AVANÇADAS --- */}
            {activePracticeId === 'templo' && (
              <>
                {/* FASE 1: INSTRUÇÃO */}
                {practicePhase === 'intro' && (
                  <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '500px' }}>
                    <Sparkles size={48} color={isDark ? '#FFD700' : '#996515'} style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#FFD700' : '#996515', fontSize: '2rem', margin: '0 0 1rem 0' }}>Prática Avançada</h2>
                    
                    <div style={{ background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(153,101,21,0.05)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', margin: 0 }}>Feche os olhos e inicie sua jornada para dentro de si.</p>
                      <p style={{ fontSize: '1.15rem', color: isDark ? '#f0e6d2' : '#2c1810', lineHeight: '1.6', marginTop: '1rem', marginBottom: 0 }}>Ao som de Beethoven, avance o quanto puder pelas etapas.</p>
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
                      Iniciar
                    </button>
                    <button onClick={() => setIsPracticeActive(false)} style={{ marginTop: '1rem', display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#888' : '#6b5744', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>Voltar ao Diário</button>
                  </div>
                )}

                {/* FASE 2: A JORNADA (TELA ESCURA MINIMALISTA) */}
                {practicePhase === 'practice' && (
                  <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', position: 'relative' }}>
                    <Sparkles size={56} color={isDark ? 'rgba(255, 215, 0, 0.2)' : 'rgba(153, 101, 21, 0.2)'} style={{ opacity: 0.7 }} />
                    <p style={{ marginTop: '2rem', color: isDark ? 'rgba(255, 215, 0, 0.4)' : 'rgba(153, 101, 21, 0.4)', fontStyle: 'italic', fontFamily: 'Georgia, serif', letterSpacing: '2px' }}>Avançando...</p>

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
                    
                    {/* AS CAIXINHAS DE SELEÇÃO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', textAlign: 'left', background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(153,101,21,0.05)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}` }}>
                      {[
                        { key: 'prac6', label: 'Nível 1' },
                        { key: 'prac7', label: 'Nível 2' },
                        { key: 'prac8', label: 'Nível 3' },
                        { key: 'prac9', label: 'Nível 4' }
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
      
      {/* WIDGET FLUTUANTE DE TAREFAS (SÓ APARECE SE DESTRANCADO) */}
      {mod2Unlocked && view !== 'mod2' && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
          
          {/* Painel Aberto */}
          {showQuickMod2 && (
            <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(26, 26, 46, 0.95)' : 'rgba(253, 251, 247, 0.95)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', border: `2px solid ${isDark ? '#FFD700' : '#996515'}`, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', width: 'max-content', maxWidth: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Star size={16} /> Práticas Diárias</h4>
                <button onClick={() => setShowQuickMod2(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#aaa' : '#777', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {mod2Tasks.filter(t => !t.isCycle).length === 0 ? (
                   <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#888', fontStyle: 'italic' }}>Nenhuma prática diária pendente.</p>
                ) : (
                  mod2Tasks.filter(t => !t.isCycle).map(task => {
                    const currentCount = (typeof mod2Daily.tasksStatus?.[task.id] === 'boolean' ? (mod2Daily.tasksStatus[task.id] ? 1 : 0) : mod2Daily.tasksStatus?.[task.id]) || 0;
                    const targetCount = task.target || 1;
                    const taskColor = getTaskColor(currentCount, targetCount, isDark);
                    
                    return (
                      <div key={task.id} onClick={() => toggleMod2Task(task)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', borderRadius: '8px', border: `1px solid ${taskColor}`, cursor: 'pointer', transition: 'all 0.2s', gap: '1rem' }}>
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
          <button onClick={() => setShowQuickMod2(!showQuickMod2)} style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
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