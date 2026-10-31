import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
import {
  BookOpen, Sunrise, Sunset, Calendar, Moon, Sun, Sparkles, ChevronRight,
  LogOut, Shuffle, Plus, X, AlertCircle, Eye, EyeOff, CheckCircle,
  Download, Target, TrendingUp, Award, Settings, Edit, Save, Flame,
  Zap, Shield, Star, Crown, Bell, MessageSquare, Menu, Lock,
  ChevronDown, ChevronUp, Mountain, Landmark, Library, Clock, ChevronLeft, Smartphone,
  ShieldAlert, Users
} from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos parado
const INACTIVITY_COUNTDOWN_S = 30;            // aviso antes de fechar


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
import { isTaskDueOn, extractInviteCode } from './lib/helpers';
import { buildCartaHistoryReport } from './lib/cartaReport';
import AdBanner from './AdBanner';
import DeferredField from './components/DeferredField';
import { DEFAULT_FV_DAILY, virtues, philosophicalQuotes, studyTips } from './constants/data';

import { translateCategory } from './constants/bookMetrics';
import { getFavoriteTheme } from './constants/ranks';

// Telas carregadas sob demanda (cada uma vira um arquivo JS separado).
const GoalsView = lazy(() => import('./views/GoalsView'));
const NotificationsView = lazy(() => import('./views/NotificationsView'));
const LeiturasView = lazy(() => import('./views/LeiturasView'));
const VirtuesLibraryView = lazy(() => import('./views/VirtuesLibraryView'));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const GdveView = lazy(() => import('./views/GdveView'));
const HistoryView = lazy(() => import('./views/HistoryView'));
const AdminPanel = lazy(() => import('./views/AdminPanel'));
const PracticeOverlay = lazy(() => import('./views/PracticeOverlay'));

// Indicador discreto enquanto o código de uma tela é baixado.
function ViewFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0', opacity: 0.6 }}>
      <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(139, 115, 85, 0.25)', borderTopColor: 'rgba(139, 115, 85, 0.9)' }} />
    </div>
  );
}

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
  const [notificationsActive, setNotificationsActive] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isCloudDataLoaded, setIsCloudDataLoaded] = useState(false);

  // --- ESTADOS DE SEGURANÇA FV (ANTE-SALA) ---
  const [fvAccessStatus, setFvAccessStatus] = useState('checking'); // 'checking', 'approved', 'pending', 'unregistered'
  const [requestName, setRequestName] = useState('');
  const [requestUnit, setRequestUnit] = useState('');
  const [requestEmail, setRequestEmail] = useState('');

  // --- PAINEL DE ADMINISTRAÇÃO DE ACESSOS ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myAdminUnits, setMyAdminUnits] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [adminRecordsList, setAdminRecordsList] = useState([]); // [{ email, units }]
  const [unitsList, setUnitsList] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isLoadingAdminPanel, setIsLoadingAdminPanel] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUnits, setNewAdminUnits] = useState([]);
  const [newUnitName, setNewUnitName] = useState('');

  // Unidades disponíveis pro formulário de "Solicitar Acesso" (vem de api/fv-access.js)
  const [availableUnits, setAvailableUnits] = useState([]);

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
      randomVirtue: false,
      groupActivity: true
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
      showToast("Erro ao salvar as configurações.");
      setSaveBtnStatus('idle');
    }
  };

  const toggleNotifications = async () => {
    if (notificationsActive) {
      showConfirm('Deseja silenciar os lembretes do Diário Filosófico?', async () => {
        try {
          await deleteToken(messaging);
          if (user) {
            await updateDoc(doc(db, 'users', user.uid), { fcmToken: deleteField() });
          }
          setNotificationsActive(false);
          showToast('🔕 Lembretes silenciados. Você não receberá mais os avisos de Prólogo e Epílogo.');
        } catch (error) {
          console.error('Erro ao silenciar:', error);
          showToast('Houve um pequeno erro. Tente novamente.');
        }
      });
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
           showToast('🔔 Lembretes ativados! Nós avisaremos você nos horários adequados.');
        }
      } else {
        showToast('As notificações estão bloqueadas no seu navegador. Para receber lembretes, clique no ícone de "Cadeado" ao lado do endereço do site e mude para "Permitir".');
      }
    } catch (error) {
      console.error('Erro ao ativar notificações:', error);
      showToast('Seu dispositivo parece não suportar esse tipo de aviso no momento.');
    }
  };

  // Estados de Navegação e Fogo Interno
  const [view, setView] = useState('today');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Só deixa preencher/editar os últimos 3 dias — evita que alguém preencha
  // dias muito antigos só para recuperar a ofensiva (streak).
  const getMinEditableDateKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleDateChange = async (newDate) => {
    if (!newDate) return;
    if (newDate < getMinEditableDateKey()) {
      showToast('Só é possível preencher ou editar os últimos 3 dias do diário. Dias mais antigos ficam disponíveis apenas para consulta no Histórico.');
      return;
    }
    setSelectedDate(newDate);
    if (user) {
      await loadTodayEntry(user.uid, newDate);
    }
  };

  // O tema também fica guardado no aparelho, para o app já abrir no tema
  // certo antes de os dados da nuvem chegarem.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a1a2e' : '#8b7355');
    try { localStorage.setItem('theme', theme); } catch { /* armazenamento indisponível */ }
  }, [theme]);
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // --- Toasts / Confirmação / Prompt no estilo do app (substituem alert/confirm/prompt nativos) ---
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  const [promptModalState, setPromptModalState] = useState(null);
  const [promptInputValue, setPromptInputValue] = useState('');

  const showToast = (message, type) => {
    const resolvedType = type || (
      /❌|erro|falhou|inválid|não foi possível|não é possível|bloqueada/i.test(message) ? 'error' :
      /✅|🔔|🔕|🗑️|sucesso|salvo|atualizad|copiado|entrou no grupo/i.test(message) ? 'success' :
      'info'
    );
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type: resolvedType }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const showConfirm = (message, onConfirm, opts = {}) => {
    setConfirmModal({
      message,
      danger: !!opts.danger,
      confirmLabel: opts.confirmLabel || 'Confirmar',
      cancelLabel: opts.cancelLabel || 'Cancelar',
      onConfirm,
      onCancel: opts.onCancel || null,
    });
  };

  // Pequena celebração (confete leve, sem lib nova) ao fechar o ciclo do dia.
  const [celebration, setCelebration] = useState(null);
  const celebrateDayComplete = () => {
    const colors = ['var(--gold)', 'var(--success)', 'var(--danger)', 'var(--blue)', 'var(--purple)', 'var(--orange)'];
    const particles = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      color: colors[i % colors.length],
      angle: Math.random() * 360,
      distance: 80 + Math.random() * 110,
      delay: Math.random() * 0.15,
      size: 6 + Math.random() * 6,
    }));
    const id = Date.now();
    setCelebration({ id, particles });
    setTimeout(() => setCelebration(prev => (prev && prev.id === id ? null : prev)), 1400);
  };

  const showPrompt = (message, onSubmit, opts = {}) => {
    setPromptInputValue(opts.defaultValue != null ? String(opts.defaultValue) : '');
    setPromptModalState({
      message,
      placeholder: opts.placeholder || '',
      inputType: opts.inputType || 'text',
      submitLabel: opts.submitLabel || 'Confirmar',
      onSubmit,
    });
  };

 
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

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Frase do dia e dica de estudo: sorteadas assim que o app abre, sem
  // depender do carregamento de dados do Firestore — antes isso ficava
  // dentro de loadTodayEntry() e, se aquela leitura falhasse por qualquer
  // motivo (rede, erro de parsing), a frase simplesmente nunca aparecia.
  useEffect(() => {
    setDailyQuote(philosophicalQuotes[Math.floor(Math.random() * philosophicalQuotes.length)]);
    setDailyStudyTip(studyTips[Math.floor(Math.random() * studyTips.length)]);
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
  const [logoutCountdown, setLogoutCountdown] = useState(INACTIVITY_COUNTDOWN_S);

  // Sugestões e Melhorias
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');

  const handleSendEmail = () => {
    if (!suggestionText.trim()) return showToast('Por favor, digite sua sugestão primeiro!');
    const subject = encodeURIComponent('Ideia/Melhoria - Diário Filosófico');
    const body = encodeURIComponent(`Olá!\n\nAqui está minha sugestão para o aplicativo:\n\n${suggestionText}`);
    window.open(`mailto:henrique.zanchi@gmail.com?subject=${subject}&body=${body}`); 
    setShowSuggestionModal(false);
    setSuggestionText('');
  };

  const handleSendWhatsApp = () => {
    if (!suggestionText.trim()) return showToast('Por favor, digite sua sugestão primeiro!');
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
  const [isDrawingVirtue, setIsDrawingVirtue] = useState(false);
  const [virtueDrawDisplay, setVirtueDrawDisplay] = useState('');
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
  const [isGeneratingCartaDegrau, setIsGeneratingCartaDegrau] = useState(false);
  const [cartaDegrauResult, setCartaDegrauResult] = useState(null);
  const [showCartaDegrauModal, setShowCartaDegrauModal] = useState(false);
  const isEnrichingRef = useRef(false);
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
  const [newGdveTaskCycleTouched, setNewGdveTaskCycleTouched] = useState(false);
  const [fvGdveCycleStatus, setFvGdveCycleStatus] = useState({});
  const [expandedCartaItems, setExpandedCartaItems] = useState({});

  // Estados do Grupo de Estudo (GDVE colaborativo) — o grupo é só um roster
  // de participantes: cada um continua com suas próprias tarefas/bastiões/
  // presença no Módulo GDVE, o grupo só serve pra saber quem avisar.
  const [myGroups, setMyGroups] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);

  // Controles de Expansão dos Blocos do Diário (Iniciam Fechados)
  const [isPrologoOpen, setIsPrologoOpen] = useState(true);
  const [isPraticasOpen, setIsPraticasOpen] = useState(false);
  const [isEscaladaOpen, setIsEscaladaOpen] = useState(false);
  const [isEpilogoOpen, setIsEpilogoOpen] = useState(false);

  // --- ESTADOS DE LEITURA E ESTUDOS ---
  const [books, setBooks] = useState([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeScanError, setBarcodeScanError] = useState('');
  const barcodeVideoRef = useRef(null);
  const barcodeControlsRef = useRef(null);
  const [newBook, setNewBook] = useState({ title: '', author: '', currentPage: 0, totalPages: 0, link: '', notes: '' });
  const [shelfSearchTerm, setShelfSearchTerm] = useState(''); // Estado para busca na estante
  const [editingBookId, setEditingBookId] = useState(null);
  const [expandedNotesId, setExpandedNotesId] = useState(null);
  const [isVirtuesOpen, setIsVirtuesOpen] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState([]); // Exclusão em lote
  const [showReadBooks, setShowReadBooks] = useState(false); // Gaveta sanfona de Lidos
  const totalForgedPages = books.reduce((acc, book) => acc + (book.currentPage || 0), 0);
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
        if (!json.items || json.items.length === 0) {
          // O Google não achou nada! Libera o livro para o usuário editar manualmente.
          const updatedBooks = books.map(b => b.id === pendingBook.id ? { ...b, isPendingEnrichment: false } : b);
          saveBooksToDb(updatedBooks);
          return;
        }
        const info = json.items?.[0]?.volumeInfo;

        const updatedBooks = books.map(b => {
          if (b.id !== pendingBook.id) return b;
          return {
            ...b,
            totalPages: info?.pageCount || b.totalPages,
            currentPage: b.status === 'lido' ? (info?.pageCount || b.currentPage || 0) : b.currentPage,
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

  // --- AUTOSAVE ---
  // Grava sozinho a cada minuto, quando o app vai para segundo plano e antes
  // do logout por inatividade. Só grava se algo mudou desde a última vez e
  // se a entrada do dia selecionado já terminou de carregar. Sem essa trava,
  // trocar de data podia gravar o texto de um dia em outro.
  const [loadedEntryDate, setLoadedEntryDate] = useState(null);
  const autoSaveDataRef = useRef({});
  const lastAutoSavedRef = useRef('');

  const buildAutoSavePayload = (data) => ({
    userId: data.user.uid,
    date: data.selectedDate,
    morningDone: data.morningDone || false,
    eveningDone: data.eveningDone || false,
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
      .filter(task => isTaskDueOn(task, data.selectedDate))
      .map(task => ({
        id: task.id, name: task.name, completed: !!(data.todayTasksStatus || {})[task.id]
      })),
    fvDaily: data.fvDaily || DEFAULT_FV_DAILY
  });

  useEffect(() => {
    const data = {
      user, selectedDate, loadedEntryDate, selectedVirtue, customVirtue, showCustomVirtue, dailyIntention,
      whereIFailed, whatIDidWell, whatILeftUndone, freeEpilogue, didMorning,
      morningDone, eveningDone,
      todayTasksStatus, fvDaily, customTasks
    };
    // Logo após carregar um dia, o estado é igual ao que está salvo: vira a
    // referência, para não regravar uma entrada que ninguém mexeu.
    if (user && loadedEntryDate && loadedEntryDate !== autoSaveDataRef.current.loadedEntryDate) {
      lastAutoSavedRef.current = JSON.stringify(buildAutoSavePayload(data));
    }
    autoSaveDataRef.current = data;
  }, [user, selectedDate, loadedEntryDate, selectedVirtue, customVirtue, showCustomVirtue, dailyIntention,
      whereIFailed, whatIDidWell, whatILeftUndone, freeEpilogue, didMorning,
      morningDone, eveningDone, todayTasksStatus, fvDaily, customTasks]);

  const performSilentAutoSave = async () => {
    const data = autoSaveDataRef.current;
    if (!data.user || data.loadedEntryDate !== data.selectedDate) return;

    const updatePayload = buildAutoSavePayload(data);
    const serialized = JSON.stringify(updatePayload);
    if (serialized === lastAutoSavedRef.current) return;

    try {
      await setDoc(doc(db, 'entries', `${data.user.uid}_${data.selectedDate}`), updatePayload, { merge: true });
      lastAutoSavedRef.current = serialized;
    } catch (e) {
      console.log('Erro no autosave silencioso:', e);
    }
  };

  const performSilentAutoSaveRef = useRef(null);
  useEffect(() => {
    performSilentAutoSaveRef.current = performSilentAutoSave;
  });

  useEffect(() => {
    const save = () => performSilentAutoSaveRef.current && performSilentAutoSaveRef.current();
    const intervalId = setInterval(save, 60000);
    const onVisibility = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
    else if (key === 'recitarHonra' || key === 'recitar7Fases' || key === 'formasGeometricas') {
      setActivePracticeId(key);
      setPracticePhase('practice'); // Pula a intro e vai direto pra tela
      setIsPracticeActive(true);
      enterFullScreen(); // Liga a tela cheia e o WakeLock para não apagar!
    }
    else {
      showToast('Prática não reconhecida.');
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
    if (current >= target) return isDark ? 'var(--success-strong)' : 'var(--success)'; 
    
    const ratio = current / target;
    if (ratio <= 0.34) return isDark ? 'var(--orange-strong)' : 'var(--orange)'; 
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
    entriesRef.current = [];
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
    setVirtueGoals([]);
    setProjectGoals([]);
    setAcceptedMissions([]);
    setFvAccessStatus('checking');
    setIsAdmin(false);
    setPendingRequests([]);
    setFvLastCartaDate('');
    setFvNextCartaDate('');
    setFvGdveReuniao('');
    setFvGdveBastiaoName('');
    setFvGdveBastiaoLink('');
    setFvUnlocked(false);
    setMyGroups([]);
    setLastDrawDate(null);
    setSelectedDate(getTodayKey()); 
    setBooks([]); 
    setFvDaily(DEFAULT_FV_DAILY);
  };

  const getTasksForToday = () => customTasks.filter(task => isTaskDueOn(task, selectedDate));

  const selectRandomVirtue = async () => {
    if (isDrawingVirtue) return;
    if (!canDrawToday()) {
      showToast('Você já sorteou sua virtude neste dia! Comprometa-se com ela até o fim do dia. 🎯');
      return;
    }
    const randomIndex = Math.floor(Math.random() * virtues.length);
    const selectedV = virtues[randomIndex].name;

    setShowCustomVirtue(false);
    setSelectedVirtue('');
    setIsDrawingVirtue(true);

    // Efeito de "roleta": cicla nomes de virtudes, desacelerando até parar
    // na sorteada — só um toque lúdico antes da revelação.
    const totalSteps = 16;
    for (let step = 0; step < totalSteps; step++) {
      const isLastStep = step === totalSteps - 1;
      setVirtueDrawDisplay(isLastStep ? selectedV : virtues[Math.floor(Math.random() * virtues.length)].name);
      const progress = step / (totalSteps - 1);
      const delay = 50 + Math.round(progress * progress * 200);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    setSelectedVirtue(selectedV);
    setIsDrawingVirtue(false);
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
    const newCount = fvClickCount + 1;
    setFvClickCount(newCount);
    if (newCount >= 6) {
      setFvUnlocked(true);
      loadMod2Config(user?.uid);
      setFvClickCount(0);
      showToast('🔓 Modo FV ativado na sessão!');
    }
    setTimeout(() => setFvClickCount(0), 3000);
  };

  const handleFvTabClick = () => {
    setView('fv'); 
  };

  const handleInstantFvLock = async () => {
    setFvUnlocked(false); 
    setView('today'); 
    showToast('🔒 Modo FV ocultado com segurança!');
  };

  // Fecha o diário depois de um tempo parado, para proteger quem usa um
  // aparelho compartilhado. O prazo é longo o bastante para ler e refletir
  // com calma antes de escrever.
  useEffect(() => {
    if (!user || showInactivityWarning || isPracticeActive) return; 
    
    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setShowInactivityWarning(true), INACTIVITY_TIMEOUT_MS);
    };
    
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    
    resetTimer();
    
    return () => {
      clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [user, showInactivityWarning, isPracticeActive]);

  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Mensagem recebida com o app aberto: ', payload);
      
      if (Notification.permission === 'granted') {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/icon-192.png',
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
            
            return INACTIVITY_COUNTDOWN_S;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setLogoutCountdown(INACTIVITY_COUNTDOWN_S);
    }
    return () => clearInterval(intervalId);
  }, [showInactivityWarning]);

  const keepAlive = () => {
    setShowInactivityWarning(false);
    setLogoutCountdown(INACTIVITY_COUNTDOWN_S);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Zera qualquer estado que possa ter sobrado de uma sessão anterior
        // (ex: troca de conta Google sem passar por "Sair" explícito) antes
        // de carregar os dados do novo usuário — sem isso, a tela podia
        // "piscar" com o app/status de acesso do usuário anterior.
        clearAllData();
        setUser(currentUser);
        setRequestEmail(currentUser.email || '');
        // Tudo em paralelo: cada leitura é independente, e esperar uma por
        // uma deixava o login lento.
        const uid = currentUser.uid;
        await Promise.all([
          loadUserData(uid),
          loadTodayEntry(uid),
          loadAllEntries(uid),
          loadCustomTasks(uid),
          loadLongTermGoals(uid),
          loadFVData(uid),
          loadBooks(uid),
        ]);
        fetchAdminPanelData(); // Silencioso: só ativa o painel se o usuário for admin
      } else {
        setUser(null);
        setIsAdmin(false);
        setPendingRequests([]);
        clearAllData();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Convite de Grupo de Estudo (GDVE) por link: ?joinGroup=CODIGO
  useEffect(() => {
    if (!user || !fvUnlocked) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('joinGroup');
    if (!code) return;
    window.history.replaceState({}, '', window.location.pathname);
    joinGroupByCode(code);
  }, [user, fvUnlocked]);



  const loadUserData = async (uid) => {
    try {
      // 1. Lê o doc do usuário (rápido, vem do cache local quando possível) e
      // já libera a tela com o status de acesso que está salvo nele.
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      let gdveStarted = false;
      const applyAccess = (status, unlocked) => {
        setFvAccessStatus(status);
        setFvUnlocked(unlocked);
        if (unlocked && !gdveStarted) { gdveStarted = true; loadMod2Config(uid); loadMyGroups(); } // Inicia o motor GDVE
      };
      if (userData) applyAccess(userData.fvStatus || 'unregistered', (userData.fvStatus || 'unregistered') === 'approved');

      // 2. Confere com o servidor (api/fv-access.js) em segundo plano: ele
      // checa a whitelist, cria o doc do usuário no primeiro acesso e corrige
      // o status se for o caso. A tela não espera por isso, a não ser no
      // primeiro acesso, quando ainda não há status salvo.
      const verifyAccess = (async () => {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const resp = await fetch('/api/fv-access', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` }
          });
          if (!resp.ok) throw new Error(`resposta ${resp.status}`);
          const data = await resp.json();
          setAvailableUnits(data.units || []);
          applyAccess(data.fvStatus || userData?.fvStatus || 'unregistered', !!data.fvUnlocked);
        } catch (e) {
          console.error('Erro ao verificar acesso FV:', e);
          if (!userData) applyAccess('unregistered', false);
        }
      })();
      if (!userData) await verifyAccess;

      if (userData) {
        setTheme(userData.theme || 'light');
        setLastDrawDate(userData.lastDrawDate || null);

        // Carrega as configurações do Guardião salvas
        if (userData.notifications) {
          setNotifSettings(userData.notifications);
        }

        if ('Notification' in window && Notification.permission === 'granted') {
          setNotificationsActive(!!userData.fcmToken);
        } else {
          setNotificationsActive(false);
        }
      }
    } catch (error) { console.error('Erro ao carregar dados:', error); }
  };

  // --- PAINEL DE ADMINISTRAÇÃO DE ACESSOS (api/fv-admin.js) ---
  const callFvAdmin = async (body) => {
    const idToken = await auth.currentUser?.getIdToken();
    const resp = await fetch('/api/fv-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body)
    });
    return { ok: resp.ok, data: await resp.json().catch(() => ({})) };
  };

  const callGdveGroups = async (body) => {
    const idToken = await auth.currentUser?.getIdToken();
    const resp = await fetch('/api/gdve-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body)
    });
    return { ok: resp.ok, data: await resp.json().catch(() => ({})) };
  };

  const loadMyGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const { ok, data } = await callGdveGroups({ action: 'listMine' });
      if (ok) setMyGroups(data.groups || []);
    } catch (e) {
      console.error('Erro ao carregar grupos GDVE:', e);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const createGroup = async () => {
    setIsCreatingGroup(true);
    try {
      const { ok, data } = await callGdveGroups({ action: 'create', name: newGroupName.trim() });
      if (!ok) { showToast(data.error || 'Erro ao criar grupo.'); return; }
      setNewGroupName('');
      setShowCreateGroupModal(false);
      await loadMyGroups();
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const joinGroupByCode = async (rawCode) => {
    const inviteCode = extractInviteCode(rawCode);
    if (!inviteCode) return;
    setIsJoiningGroup(true);
    try {
      const { ok, data } = await callGdveGroups({ action: 'join', inviteCode });
      if (!ok) { showToast(data.error || 'Convite inválido ou expirado.'); return; }
      showToast(`Você entrou no grupo "${data.group?.name || ''}"!`);
      await loadMyGroups();
    } finally {
      setIsJoiningGroup(false);
    }
  };

  const copyInviteLink = (code) => {
    const link = `${window.location.origin}${window.location.pathname}?joinGroup=${code}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(
        () => showToast('Link de convite copiado! Envie para quem você quer chamar para o grupo.'),
        () => showToast(`Copie o link manualmente:\n${link}`)
      );
    } else {
      showToast(`Copie o link manualmente:\n${link}`);
    }
  };

  const removeGroupMember = async (groupId, memberUid) => {
    showConfirm('Remover este participante do grupo?', async () => {
      const { ok, data } = await callGdveGroups({ action: 'removeMember', groupId, memberUid });
      if (!ok) return showToast(data.error || 'Erro ao remover participante.');
      await loadMyGroups();
    }, { danger: true });
  };

  const leaveGroupHandler = async (groupId) => {
    showConfirm('Sair deste grupo?', async () => {
      const { ok, data } = await callGdveGroups({ action: 'leaveGroup', groupId });
      if (!ok) return showToast(data.error || 'Erro ao sair do grupo.');
      await loadMyGroups();
    });
  };

  const deleteGroupHandler = async (groupId, groupName) => {
    showConfirm(`Excluir o grupo "${groupName}"? Essa ação não pode ser desfeita.`, async () => {
      const { ok, data } = await callGdveGroups({ action: 'deleteGroup', groupId });
      if (!ok) return showToast(data.error || 'Erro ao excluir grupo.');
      await loadMyGroups();
    }, { danger: true });
  };

  // Avisa os colegas de grupo (fire-and-forget) quando o usuário conclui
  // algo no Módulo GDVE — tarefa, bastião ou presença na reunião.
  const notifyGroupActivity = (activity) => {
    myGroups.forEach(g => {
      callGdveGroups({ action: 'notify', groupId: g.id, activity }).catch(() => {});
    });
  };

  const fetchAdminPanelData = async () => {
    try {
      const { ok, data } = await callFvAdmin({ action: 'list' });
      if (ok) {
        setIsAdmin(true);
        setIsSuperAdmin(!!data.isSuperAdmin);
        setMyAdminUnits(data.myUnits || []);
        setPendingRequests(data.pending || []);
        setUnitsList(data.units || []);
        if (data.admins) setAdminRecordsList(data.admins);
      } else {
        setIsAdmin(false);
      }
    } catch (e) {
      setIsAdmin(false);
    }
  };

  const decidePendingRequest = async (uid, decision) => {
    setIsLoadingAdminPanel(true);
    try {
      const { ok, data } = await callFvAdmin({ action: 'decide', uid, decision });
      if (ok) {
        setPendingRequests(prev => prev.filter(r => r.uid !== uid));
      } else {
        showToast(data.error || 'Erro ao processar o pedido.');
      }
    } catch (e) {
      showToast('Erro ao processar o pedido. Verifique sua conexão.');
    } finally {
      setIsLoadingAdminPanel(false);
    }
  };

  const addAdminEmail = async () => {
    const email = newAdminEmail.trim();
    if (!email) return;
    setIsLoadingAdminPanel(true);
    try {
      const { ok, data } = await callFvAdmin({ action: 'addAdmin', email, units: newAdminUnits });
      if (ok) {
        setAdminRecordsList(data.admins || []);
        setNewAdminEmail('');
        setNewAdminUnits([]);
      } else {
        showToast(data.error || 'Erro ao adicionar administrador.');
      }
    } catch (e) {
      showToast('Erro ao adicionar administrador. Verifique sua conexão.');
    } finally {
      setIsLoadingAdminPanel(false);
    }
  };

  const removeAdminEmail = async (email) => {
    showConfirm(`Remover "${email}" da lista de administradores?`, async () => {
      setIsLoadingAdminPanel(true);
      try {
        const { ok, data } = await callFvAdmin({ action: 'removeAdmin', email });
        if (ok) {
          setAdminRecordsList(data.admins || []);
        } else {
          showToast(data.error || 'Erro ao remover administrador.');
        }
      } catch (e) {
        showToast('Erro ao remover administrador. Verifique sua conexão.');
      } finally {
        setIsLoadingAdminPanel(false);
      }
    }, { danger: true });
  };

  const addUnit = async () => {
    // Aceita colar várias unidades de uma vez: uma por linha, separadas por
    // vírgula, ou por ponto-e-vírgula (cópias de fora às vezes perdem a
    // quebra de linha e viram uma linha só).
    const units = newUnitName.split(/[\n,;]+/).map(u => u.trim()).filter(Boolean);
    if (units.length === 0) return;
    setIsLoadingAdminPanel(true);
    try {
      const { ok, data } = await callFvAdmin({ action: 'addUnit', units });
      if (ok) {
        setUnitsList(data.units || []);
        setNewUnitName('');
      } else {
        showToast(data.error || 'Erro ao adicionar unidade(s).');
      }
    } catch (e) {
      showToast('Erro ao adicionar unidade(s). Verifique sua conexão.');
    } finally {
      setIsLoadingAdminPanel(false);
    }
  };

  const removeUnit = async (unit) => {
    showConfirm(`Remover a unidade "${unit}"? Admins vinculados a ela deixarão de ter essa unidade.`, async () => {
      setIsLoadingAdminPanel(true);
      try {
        const { ok, data } = await callFvAdmin({ action: 'removeUnit', unit });
        if (ok) {
          setUnitsList(data.units || []);
          if (data.admins) setAdminRecordsList(data.admins);
        } else {
          showToast(data.error || 'Erro ao remover unidade.');
        }
      } catch (e) {
        showToast('Erro ao remover unidade. Verifique sua conexão.');
      } finally {
        setIsLoadingAdminPanel(false);
      }
    }, { danger: true });
  };


  const handleRequestAccess = async () => {
    const emailLimpo = requestEmail.trim();
    if (!requestName.trim() || !requestUnit.trim() || !emailLimpo) return showToast("Por favor, preencha seu nome, e-mail e a unidade.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) return showToast("Digite um e-mail válido.");
    try {
      // 1. Salva no banco de dados
      await setDoc(doc(db, 'users', user.uid), {
        fvStatus: 'pending',
        requestName: requestName.trim(),
        requestUnit: requestUnit.trim(),
        requestEmail: emailLimpo,
        requestDate: Timestamp.now()
      }, { merge: true });

      setFvAccessStatus('pending');

      // 2. Dispara o aviso para o Diretor via WhatsApp
      const adminPhone = "5562991729783"; // Seu número
      const text = encodeURIComponent(`*Novo Pedido de Acesso - Diário FV* 🛡️\n\n*Nome:* ${requestName.trim()}\n*Unidade:* ${requestUnit.trim()}\n*E-mail de acesso:* ${emailLimpo}\n\nPor favor, acesse o Firebase para liberar o meu perfil.`);
      window.open(`https://wa.me/${adminPhone}?text=${text}`, '_blank');

    } catch (e) {
      showToast("Erro ao enviar a solicitação. Tente novamente.");
    }
  };

  const handleBulkAddWhitelist = async (rawText) => {
    if (!rawText.trim()) return showToast("Cole a lista de e-mails primeiro.");

    // Transforma o texto em uma lista limpa, removendo espaços e tratando vírgulas ou quebras de linha
    const emailList = rawText
      .split(/[\n,]+/)
      .map(e => e.replace(/["']/g, "").trim().toLowerCase()) // Remove aspas simples e duplas
      .filter(e => e.includes('@'));

    if (emailList.length === 0) return showToast("Nenhum e-mail válido encontrado.");

    try {
      const whitelistRef = doc(db, 'admin', 'whitelist');
      await setDoc(whitelistRef, { emails: emailList }, { merge: true });
      showToast(`✅ Sucesso! ${emailList.length} e-mails foram importados para a Lista VIP.`);
    } catch (e) {
      console.error(e);
      showToast("Erro ao salvar no Firebase. Verifique suas permissões.");
    }
  };

  const loadTodayEntry = async (uid, dateToLoad = null) => {
    const targetDate = dateToLoad || selectedDate;
    setLoadedEntryDate(null); // bloqueia o autosave até o dia novo carregar
    try {
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

      setLoadedEntryDate(targetDate);
    } catch (error) {
      console.error('Erro ao carregar entrada:', error);
    }
  };

  // Uma entrada só aparece no histórico se tiver algo preenchido.
  const isMeaningfulEntry = (data) => {
    const hasFvData = data.fvDaily && (
      data.fvDaily.item1 || data.fvDaily.item2 || data.fvDaily.item34 || data.fvDaily.item5 || data.fvDaily.item6 || data.fvDaily.item7 ||
      (data.fvDaily.praticas && Object.values(data.fvDaily.praticas).some(v => v === true)) ||
      (data.fvDaily.gdveTasksStatus && Object.values(data.fvDaily.gdveTasksStatus).some(v => v)) ||
      data.fvDaily.gdveAttendance
    );
    return !!(data.morningDone || data.eveningDone || hasFvData);
  };

  // Cópia sempre atual da lista, para atualizar uma única entrada sem
  // precisar baixar o histórico inteiro de novo.
  const entriesRef = useRef([]);

  const applyEntries = (loadedEntries) => {
    loadedEntries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    entriesRef.current = loadedEntries;
    setEntries(loadedEntries);
    computeStreaks(loadedEntries);
  };

  const loadAllEntries = async (uid) => {
    try {
      const q = query(collection(db, 'entries'), where('userId', '==', uid));
      const querySnapshot = await getDocs(q);
      const loadedEntries = [];
      querySnapshot.forEach((d) => {
        const data = d.data();
        if (isMeaningfulEntry(data)) loadedEntries.push({ id: d.id, ...data });
      });
      applyEntries(loadedEntries);
    } catch (error) { console.error('Erro ao carregar entradas:', error); }
  };

  // Relê só a entrada de um dia, depois de gravá-la ou apagá-la.
  const refreshEntry = async (uid, dateKey) => {
    try {
      const id = `${uid}_${dateKey}`;
      const snap = await getDoc(doc(db, 'entries', id));
      const others = entriesRef.current.filter(e => e.id !== id);
      const data = snap.exists() ? snap.data() : null;
      applyEntries(data && isMeaningfulEntry(data) ? [...others, { id, ...data }] : others);
    } catch (error) { console.error('Erro ao atualizar entrada:', error); }
  };

  const computeStreaks = (loadedEntries) => {
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
  };

  const loadBooks = async (uid) => {
    if (!uid) return;
    try {
      const docRef = doc(db, 'userBooks', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setBooks(docSnap.data().books || []);
      }
    } catch (error) { console.error('Erro ao carregar livros:', error); }
  };

  const saveBooksToDb = async (updatedBooks) => {
    // Marca quando cada livro avançou (ou entrou na estante). Os avisos de
    // "leitura parada", no app e no Guardião, dependem dessa data.
    const previousById = new Map(books.map(b => [b.id, b]));
    const nowIso = new Date().toISOString();
    const withProgressDate = updatedBooks.map(b => {
      const prev = previousById.get(b.id);
      const progressed = !prev || (b.currentPage || 0) !== (prev.currentPage || 0);
      return progressed ? { ...b, updatedAt: nowIso } : b;
    });
    // O JSON.stringify remove qualquer campo 'undefined' escondido nos livros,
    // que o Firestore recusaria.
    const livrosSanitizados = JSON.parse(JSON.stringify(withProgressDate));
    
    setBooks(livrosSanitizados);
    
    if (user) {
      try { 
        await setDoc(doc(db, 'userBooks', user.uid), { books: livrosSanitizados }, { merge: true }); 
      } catch (error) { 
        console.error('Erro ao salvar livros:', error); 
      }
    }
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

  // Busca exata por ISBN (do código de barras) — sem langRestrict, porque
  // isso filtraria por idioma e poderia esconder um resultado válido de um
  // livro em outro idioma que tenha exatamente aquele ISBN.
  const searchBookByIsbn = async (isbn) => {
    setIsSearchingBooks(true);
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=5`);
      const data = await response.json();
      const formattedResults = data.items?.filter(item => item.volumeInfo?.title).map(item => ({
        id: item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.join(', ') || 'Autor desconhecido',
        totalPages: item.volumeInfo.pageCount || 0,
        thumbnail: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
        category: item.volumeInfo.categories?.[0] || 'Filosofia'
      })) || [];
      setBookSearchQuery(isbn);
      setBookSearchResults(formattedResults);
      if (formattedResults.length === 0) {
        showToast(`Nenhum livro encontrado para o código ${isbn}. Preencha os dados manualmente.`);
      }
    } catch (error) {
      console.error('Erro na busca por ISBN:', error);
      showToast('Erro ao buscar o livro pelo código. Preencha os dados manualmente.');
    } finally {
      setIsSearchingBooks(false);
    }
  };

  // Câmera + leitor de código de barras: liga/desliga junto com o modal,
  // e o cleanup do effect garante que a câmera é sempre liberada (some
  // sozinha se o usuário fechar o modal antes de achar um código).
  useEffect(() => {
    if (!showBarcodeScanner) return;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, barcodeVideoRef.current, (result, error, ctrls) => {
          if (result && !cancelled) {
            ctrls.stop();
            barcodeControlsRef.current = null;
            setShowBarcodeScanner(false);
            setShowAddBook(true);
            setEditingBookId(null);
            searchBookByIsbn(result.getText());
          }
        });
        if (cancelled) { controls.stop(); return; }
        barcodeControlsRef.current = controls;
      } catch (e) {
        console.error('Erro ao acessar câmera:', e);
        setBarcodeScanError('Não foi possível acessar a câmera. Verifique se você concedeu permissão de câmera ao navegador.');
      }
    })();
    return () => {
      cancelled = true;
      barcodeControlsRef.current?.stop();
      barcodeControlsRef.current = null;
    };
  }, [showBarcodeScanner]);

  // =========================================================================
  // OBSERVADOR: AUTO-CORRETOR DE BASTIÕES
  // =========================================================================
  useEffect(() => {
    // Só quem tem tarefas de Bastião/leitura precisa do catálogo, que é
    // carregado sob demanda.
    const temTarefaDeLeitura = fvGdveTasks.some(task => {
      const n = (task.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return n.includes('bastiao') || n.includes('leitura');
    });
    if (!temTarefaDeLeitura) return;
    let cancelado = false;

    import('./constants/bastioes').then(({ BASTIOES_DB }) => {
    if (cancelado) return;
    let precisaSalvar = false;
    
    const tasksCorrigidas = fvGdveTasks.map(task => {
      const taskNameLower = task.name.toLowerCase();
      const taskNameSemAcento = taskNameLower.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const isBastiaoTask = taskNameSemAcento.includes('bastiao') || taskNameSemAcento.includes('leitura');

      if (isBastiaoTask) {
        const limpaTexto = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const textoLimpoTask = limpaTexto(task.name);
        let bastiaoUnico = null;
        
        // 1. Tenta achar pelo número
        const matchNumero = task.name.match(/\d+/);
        if (matchNumero) {
           const numeroEncontrado = parseInt(matchNumero[0], 10).toString();
           bastiaoUnico = BASTIOES_DB.find(b => b.numero === numeroEncontrado);
        }
        
        // 2. Se não achou número, tenta pelo nome
        if (!bastiaoUnico) {
           const termoBusca = textoLimpoTask.replace('bastiao', '').replace('leitura', '').replace('ler', '').replace(/(^|\s)o(\s|$)/g, ' ').trim();
           if (termoBusca.length > 3) { 
              const resultados = BASTIOES_DB.filter(b => {
                 const tituloLimpo = limpaTexto(b.titulo);
                 if (tituloLimpo.length < 3) return false; 
                 return tituloLimpo.includes(termoBusca) || termoBusca.includes(tituloLimpo);
              });
              if (resultados.length === 1) bastiaoUnico = resultados[0];
           }
        }

        // 3. Se achou uma obra única E o nome atual está diferente do oficial, corrige!
        if (bastiaoUnico && task.name !== bastiaoUnico.nomeCompleto) {
           precisaSalvar = true;
           return { ...task, name: bastiaoUnico.nomeCompleto };
        }
      }
      return task; // Se não for bastião ou não precisar corrigir, devolve intacto
    });

    // Se houve alguma correção, atualiza a tela e o Firebase automaticamente
    if (precisaSalvar) {
       setFvGdveTasks(tasksCorrigidas);
       if (user) {
          setDoc(doc(db, 'fvData', user.uid), { fvGdveTasks: tasksCorrigidas }, { merge: true });
       }
    }
    }).catch(e => console.error('Erro ao carregar catálogo de Bastiões:', e));
    return () => { cancelado = true; };
  }, [fvGdveTasks, user]); // Fica observando sempre que a lista de tarefas mudar

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
        const loadedConfig = docSnap.data().config;
        // Migração transparente: quem já tinha um config salvo antes da prática
        // "Formas Geométricas" existir não ganha ela automaticamente — completa
        // a lista aqui, uma vez, sem precisar de tela de admin pra isso.
        if (Array.isArray(loadedConfig.praticas) && !loadedConfig.praticas.some(p => p.key === 'formasGeometricas')) {
          loadedConfig.praticas = [...loadedConfig.praticas, { key: 'formasGeometricas', label: 'Formas Geométricas' }];
          setDoc(docRef, { config: loadedConfig }, { merge: true }).catch(e => console.error('Erro ao migrar config (formasGeometricas):', e));
        }
        setFvConfig(loadedConfig);
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
            { key: 'camara', label: 'Câmara de Purificação' },
            { key: 'formasGeometricas', label: 'Formas Geométricas' }
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
      showToast('Por favor, selecione pelo menos um dia da semana.');
      return;
    }
    if (newTaskRecurrence === 'biweekly' && !newTaskBaseDate) {
      showToast('Por favor, selecione a data de início para a tarefa quinzenal.');
      return;
    }

    const isDuplicate = customTasks.some(t => t.name.toLowerCase().trim() === newTaskName.trim().toLowerCase() && t.id !== editingTaskId);
    if (isDuplicate) {
      showToast('Você já tem uma prática cadastrada com este nome!');
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
      catch (error) { showToast('O Firebase reclamou de algo, mas a tarefa está salva no seu dispositivo.'); }
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
    let newStatus;
    setTodayTasksStatus(prev => {
      newStatus = { ...prev, [taskId]: !prev[taskId] };
      return newStatus;
    });

    if (user) {
      const todayKey = selectedDate;
      const updatedSnapshot = getTasksForToday().map(task => ({
        id: task.id, name: task.name, completed: !!newStatus[task.id]
      }));

      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          userId: user.uid, date: todayKey, tasksStatus: newStatus, tasksSnapshot: updatedSnapshot
        }, { merge: true });
        await refreshEntry(user.uid, todayKey);
      } catch (error) { console.error('Erro ao salvar o status da tarefa:', error); }
    }
  };  

  const saveMorning = async () => {
    const finalVirtue = showCustomVirtue ? customVirtue : selectedVirtue;
    if (!finalVirtue || !finalVirtue.trim()) { showToast('Por favor, selecione ou digite uma virtude para o dia.'); return; }

    const tasksSnapshot = getTasksForToday().map(task => ({
      id: task.id, name: task.name, completed: !!todayTasksStatus[task.id]
    }));

    const todayKey = selectedDate;


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
      morningTimestamp: Timestamp.now()
    };

    try {
      await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), entry, { merge: true });
      setMorningDone(true); 
      showToast('✅ Prólogo salvo com sucesso!');
      refreshEntry(user.uid, todayKey);
      // Momento natural para oferecer os lembretes: logo depois do primeiro
      // Prólogo, e não segundos depois do login.
      if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => setShowNotificationPrompt(true), 1500);
      }
    } catch (error) { 
      showToast('Erro ao salvar prólogo. Verifique sua conexão.'); 
    }
  };

  const saveEvening = async () => {
    const hasSpecifics = (whereIFailed && whereIFailed.trim()) && (whatIDidWell && whatIDidWell.trim()) && (whatILeftUndone && whatILeftUndone.trim());
    const hasFreeText = freeEpilogue && freeEpilogue.trim();

    if (!hasSpecifics && !hasFreeText) {
      showToast('Por favor, responda as 3 perguntas estruturadas OU utilize o campo de Reflexão Livre.'); return;
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
      await refreshEntry(user.uid, todayKey);
      showToast('✅ Epílogo salvo! Você fechou o ciclo de hoje.');
      celebrateDayComplete();
    } catch (error) {
      console.error(error);
      showToast('Erro ao salvar epílogo. Tente novamente.'); 
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
    showConfirm("Deseja excluir esta meta?", () => {
      if (type === 'virtue') {
        const newList = virtueGoals.filter(g => g.id !== id);
        setVirtueGoals(newList); saveLongTermGoals(newList, null, null);
      } else {
        const newList = projectGoals.filter(g => g.id !== id);
        setProjectGoals(newList); saveLongTermGoals(null, newList, null);
      }
    }, { danger: true });
  };

  const toggleAcceptedMission = (id) => {
    const newList = acceptedMissions.map(m => m.id === id ? { ...m, completed: !m.completed } : m);
    setAcceptedMissions(newList);
    saveLongTermGoals(null, null, newList);
  };

  const removeAcceptedMission = (id) => {
    showConfirm("Deseja abandonar esta missão? A verdadeira derrota é desistir de lutar.", () => {
      const newList = acceptedMissions.filter(m => m.id !== id);
      setAcceptedMissions(newList);
      saveLongTermGoals(null, null, newList);
    }, { danger: true });
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
    setNewGdveTaskCycleTouched(false);
    setEditingGdveTaskId(null);
    saveGdveTasksToDB(newTasks);
  };

  const startEditingGdveTask = (task) => {
    setEditingGdveTaskId(task.id);
    setNewGdveTaskName(task.name);
    setNewGdveTaskTarget(task.target || 1);
    setNewGdveTaskIsCycle(task.isCycle || false);
    // Tarefa já existente: não deixa a detecção automática sobrescrever a escolha original ao editar o nome.
    setNewGdveTaskCycleTouched(true);
  };

  const removeGdveTask = (id) => {
    const newTasks = fvGdveTasks.filter(t => t.id !== id);
    setFvGdveTasks(newTasks);
    saveGdveTasksToDB(newTasks);
  };

  const toggleGdveTask = async (task) => {
    if (task.isCycle) {
      // Tarefas de Ciclo: Ficam salvas globalmente e não zeram todo dia
      const willComplete = !fvGdveCycleStatus[task.id];
      const newStatus = { ...fvGdveCycleStatus, [task.id]: willComplete };
      setFvGdveCycleStatus(newStatus);
      if (user) { await setDoc(doc(db, 'fvData', user.uid), { gdveCycleStatus: newStatus }, { merge: true }); }
      if (willComplete) notifyGroupActivity(`concluiu: "${task.name}"`);
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
      if (selectedDate === getTodayKey()) setTodayFvDaily(newFvDaily);
      if (user) {
        await setDoc(doc(db, 'entries', `${user.uid}_${selectedDate}`), { userId: user.uid, date: selectedDate, fvDaily: newFvDaily }, { merge: true });
        await refreshEntry(user.uid, selectedDate);
      }
      const target = task.target || 1;
      if (newVal >= target && currentVal < target) notifyGroupActivity(`concluiu: "${task.name}"`);
    }
  };

  const registerGdveAttendance = async () => {
    const isAttending = !fvDaily.gdveAttendance;
    const newFvDaily = { ...fvDaily, gdveAttendance: isAttending };
    setFvDaily(newFvDaily);
    if (selectedDate === getTodayKey()) setTodayFvDaily(newFvDaily);

    // Roda em ambos os caminhos (usuário confirma ou não o avanço de 15 dias)
    const finalizeAttendanceSave = async () => {
      if (user) {
        await setDoc(doc(db, 'entries', `${user.uid}_${selectedDate}`), { userId: user.uid, date: selectedDate, fvDaily: newFvDaily }, { merge: true });
        await refreshEntry(user.uid, selectedDate);
      }
    };

    // A Mágica dos 15 dias e da Limpeza do Ciclo
    if (isAttending) {
      notifyGroupActivity('confirmou presença na Reunião do GDVE');
      showConfirm(
        "Deseja marcar a próxima reunião para 15 dias APÓS ESTA DATA? (Isso também vai zerar as suas tarefas de 'Ciclo' pendentes).",
        async () => {
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

          if (user) { await setDoc(doc(db, 'fvData', user.uid), { gdveReuniao: nextDateStr, gdveCycleStatus: {} }, { merge: true }); }
          await finalizeAttendanceSave();
        },
        { onCancel: finalizeAttendanceSave }
      );
    } else {
      await finalizeAttendanceSave();
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
      showToast("✅ Acompanhamento Discipular salvo com sucesso!");
    } catch (error) { console.error("Erro ao salvar datas FV:", error); }
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
        
        await refreshEntry(user.uid, todayKey); 
        
        showToast('✅ Reflexões da Carta de Degrau salvas com sucesso!');
      } catch (error) { console.error(error); showToast('Erro ao salvar os textos.'); }
    }
  };

  const gerarCartaDegrau = async () => {
    if (!user) return;
    setIsGeneratingCartaDegrau(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const resp = await fetch('/api/carta-degrau', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showToast(data.error || 'Erro ao gerar a Carta de Degrau.');
        return;
      }
      setCartaDegrauResult(data);
      setShowCartaDegrauModal(true);
    } catch (error) {
      console.error('Erro ao gerar Carta de Degrau:', error);
      showToast('Erro ao gerar a Carta de Degrau. Verifique sua conexão.');
    } finally {
      setIsGeneratingCartaDegrau(false);
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
        
        await refreshEntry(user.uid, todayKey); 
        
        showToast('✅ Práticas Internas salvas com sucesso!');
      } catch (error) { console.error(error); showToast('Erro ao salvar as práticas.'); }
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
    let diasVoluntariado = 0; let diasPraticasPsicologia = 0; let totalPraticasPsicologia = 0;
    
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
        totalPraticasPsicologia += Object.values(fv.praticas).filter(v => v === true).length;
      }

      // A MÁGICA: O app lê o nome das tarefas que você marcou como concluídas nos dias
      if (entry.tasksSnapshot) {
        entry.tasksSnapshot.forEach(task => {
           if (task.completed) {
             const tName = task.name.toLowerCase();
             if (tName.includes('limpeza') || tName.includes('faxina') || tName.includes('mutirão')) countLimpeza++;
             if (/\bgn\b/.test(tName) || tName.includes('guarda noturna')) countGN++;
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
      showToast("✅ Relatório gerado com sucesso! A IA cruzou seus dados do diário e suas tarefas do mês. O texto já está copiado na sua Área de Transferência.");
    }).catch(err => {
      console.error('Falha ao copiar:', err);
      showToast("Erro ao copiar. Seu navegador pode ter bloqueado a ação.");
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
    if (selectedDate === getTodayKey()) setTodayFvDaily(newFvDaily);
    setIsPracticeActive(false);
    exitFullScreen();

    if (user) {
      const todayKey = selectedDate;
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          userId: user.uid, date: todayKey, fvDaily: newFvDaily
        }, { merge: true });
        await refreshEntry(user.uid, todayKey);
        // Feedback visual para o usuário saber que salvou no FV
        showToast('✅ Prática concluída e registrada com sucesso no seu Diário (FV)!');
      } catch (error) { console.error("Erro ao salvar prática:", error); }
    }
  };

  const confirmTemploPractice = async () => {
    const newFvDaily = {
      ...fvDaily,
      praticas: { ...fvDaily.praticas, ...temploSelections }
    };
    setFvDaily(newFvDaily);
    if (selectedDate === getTodayKey()) setTodayFvDaily(newFvDaily);
    setIsPracticeActive(false);
    exitFullScreen();

    if (user) {
      const todayKey = selectedDate;
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          userId: user.uid, date: todayKey, fvDaily: newFvDaily
        }, { merge: true });
        await refreshEntry(user.uid, todayKey);
      } catch (error) {
        console.error("Erro ao salvar prática do Templo:", error);
        showToast('⚠️ A prática não foi salva. Verifique sua conexão e tente novamente.');
      }
    }
  };

  const deleteEntry = async (dateKey) => {
    // Fricção cognitiva: obriga a digitar para evitar exclusão acidental
    const dataFormatada = dateKey.split('-').reverse().join('/');
    showPrompt(
      `A exclusão é permanente e quebrará sua corrente de constância (Streak) se for um dia passado.\n\nPara excluir o registro do dia ${dataFormatada}, digite a palavra exata: APAGAR`,
      async (confirmacao) => {
        if (confirmacao !== 'APAGAR') {
          showToast('❌ Exclusão cancelada. A palavra foi digitada incorretamente.');
          return;
        }
        try {
          await deleteDoc(doc(db, 'entries', `${user.uid}_${dateKey}`));
          await refreshEntry(user.uid, dateKey);
          showToast('🗑️ Registro excluído com sucesso.');
        } catch (error) {
          showToast('Erro ao excluir a entrada. Verifique sua conexão.');
        }
      },
      { placeholder: 'APAGAR', submitLabel: 'Excluir' }
    );
  };

  const exportToCSV = () => {
    if (entries.length === 0) { showToast('Não há entradas para exportar'); return; }
    
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

    // Neutraliza f\u00F3rmulas (=, +, -, @) para evitar CSV injection ao abrir no Excel/Sheets
    const sanitizeCell = (cell) => {
      const str = String(cell);
      return /^[=+\-@]/.test(str) ? `'${str}` : str;
    };

    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(row => { csvContent += row.map(cell => `"${sanitizeCell(cell).replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = fvUnlocked ? `relatorio-fv-${getTodayKey()}.csv` : `diario-filosofico-${getTodayKey()}.csv`; 
    link.click();
  };

  // Histórico da Carta de Degrau: o ciclo desde a última Carta, organizado
  // por item e por semana, para o discípulo enxergar a própria trajetória.
  const exportFvReportTXT = () => {
    const report = buildCartaHistoryReport({
      entries,
      items: fvConfig?.itensCarta,
      lastCartaDate: fvLastCartaDate,
      masterName: fvMasterName,
      todayKey: getTodayKey(),
    });
    if (!report) {
      showToast('Ainda não há respostas da Carta de Degrau neste ciclo para exportar.');
      return;
    }
    // O BOM faz o Bloco de Notas do Windows abrir o arquivo com acentos certos.
    const blob = new Blob(['﻿' + report.text], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `Historico_Carta_de_Degrau_${report.periodStart}_a_${report.periodEnd}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
        else showToast('Formato não suportado. Use CSV, JSON ou TXT.');
      } catch (error) { showToast('Erro ao importar arquivo.'); }
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
    await loadAllEntries(user.uid); showToast(`✅ ${imported} entradas importadas com sucesso!`);
  };

  const importFromJSON = async (content) => {
    const data = JSON.parse(content);
    let imported = 0;
    for (const entry of data) {
      if (!entry.date) continue;
      const newEntry = { ...entry, userId: user.uid, importedAt: Timestamp.now() };
      try { await setDoc(doc(db, 'entries', `${user.uid}_${entry.date}`), newEntry); imported++; } catch (error) { console.error(`Erro ao importar ${entry.date}`); }
    }
    await loadAllEntries(user.uid); showToast(`✅ ${imported} entradas importadas com sucesso!`);
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
    await loadAllEntries(user.uid); showToast(`✅ ${imported} entradas importadas com sucesso!`);
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
    // fvUnlocked é sempre recalculado a partir de fvStatus no próximo login
    // (api/fv-access.js), então não precisa (nem pode mais) ser zerado aqui.
    setFvUnlocked(false);
    await signOut(auth);
    setView('today');
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (user) { await updateDoc(doc(db, 'users', user.uid), { theme: newTheme }); }
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
      horasVoluntariadoMin: 0, horasAssistidaMin: 0, horasMinistradaMin: 0,
      diasPraticas: 0, countAulaRegular: 0, countEd: 0, countCrm: 0,
      countRaio: 0, countLimpeza: 0, countGN: 0
    };

    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    const cicloEntries = entries.filter(e => new Date(e.date + 'T12:00:00') >= trintaDiasAtras);

    cicloEntries.forEach(entry => {
      const fv = entry.fvDaily || {};

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

      if (fv.praticas && Object.values(fv.praticas).some(v => v === true)) {
        stats.diasPraticas++;
      }

      if (fv.aulaRegularPresenca === 'Sim') stats.countAulaRegular++;
      if (fv.aulaEdPresenca === 'Sim') stats.countEd++;
      if (fv.crmPresenca === 'Sim') stats.countCrm++;
      if (fv.reuniaoRaioPresenca === 'Sim') stats.countRaio++;

      if (entry.tasksSnapshot) {
        entry.tasksSnapshot.forEach(task => {
           if (task.completed) {
             const tName = task.name.toLowerCase();
             if (tName.includes('limpeza') || tName.includes('faxina') || tName.includes('mutirão')) stats.countLimpeza++;
             if (/\bgn\b/.test(tName) || tName.includes('guarda noturna')) stats.countGN++;
           }
        });
      }
    });

    let freqPraticas = "Nunca";
    if (stats.diasPraticas >= 28) freqPraticas = "Sempre";
    else if (stats.diasPraticas >= 20) freqPraticas = "Frequentemente";
    else if (stats.diasPraticas >= 12) freqPraticas = "Às vezes";
    else if (stats.diasPraticas > 0) freqPraticas = "Raramente";

    const fmt = (m) => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
    return { ...stats, hVol: fmt(stats.horasVoluntariadoMin), hAs: fmt(stats.horasAssistidaMin), hMin: fmt(stats.horasMinistradaMin), freqPraticas };
  };

  // --- TRADUTOR DO BADGE DE PRÁTICAS ---
  const getPraticasBadgeInfo = (dias) => {
    if (dias >= 28) return { label: 'Sempre', color: 'var(--gold-bright)', icon: Sun };
    if (dias >= 20) return { label: 'Frequente', color: 'var(--orange)', icon: Flame };
    if (dias >= 12) return { label: 'Às vezes', color: 'var(--success)', icon: Target };
    if (dias > 0) return { label: 'Raramente', color: 'var(--danger)', icon: Sparkles };
    return { label: 'Nunca', color: isDark ? 'var(--gray-strong)' : '#999', icon: Moon };
  };

  // --- PINCEL MÁGICO UNIVERSAL (Acessível por todas as abas) ---
  const getBlockStyle = (status, isOpen, activeBorder) => {
    const corPadrao = activeBorder || 'var(--t-accent-bright)';
    const corConcluido = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const corAtrasado = 'var(--danger)'; // Vermelho Urgência

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

    // Sem sombra decorativa aqui: a borda (que já carrega o status) basta
    // pra separar o cartão do fundo. Só o alerta de atraso mantém um brilho,
    // porque ali a sombra é sinal, não decoração.
    return {
      background: 'var(--t-surface-soft)',
      borderRadius: '16px', border, overflow: 'hidden', transition: 'all 0.4s ease',
      filter, opacity, boxShadow: (status === 'overdue' && !isOpen) ? '0 0 15px rgba(231, 76, 60, 0.3)' : 'none'
    };
  };

  const getHeaderStyle = (status, isOpen) => {
    let bg = isOpen ? 'transparent' : (isDark ? 'rgba(0,0,0,0.2)' : 'var(--bg-light)');
    if (status === 'full' && !isOpen) bg = 'transparent';
    if (status === 'partial' && !isOpen) bg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
    if (status === 'overdue' && !isOpen) bg = isDark ? 'rgba(231, 76, 60, 0.1)' : 'rgba(231, 76, 60, 0.05)';
    
    return {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', cursor: 'pointer', 
      background: bg
    };
  };

  const renderTitle = (text, status, isOpen, icon) => {
    let titleColor = 'var(--t-text)';
    if (status === 'overdue') titleColor = 'var(--danger)';
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {icon}
        <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', color: titleColor, fontFamily: "'Cinzel', serif", textDecoration: status === 'full' && !isOpen ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {text}
          {status === 'partial' && !isOpen && <span style={{fontSize: '0.8rem', opacity: 0.8, fontStyle: 'italic', fontFamily: 'Georgia, serif'}}>(Em Andamento)</span>}
          {status === 'overdue' && <span style={{fontSize: '0.8rem', color: 'var(--danger)', fontStyle: 'italic', fontFamily: 'Georgia, serif'}}>(Atrasada!)</span>}
        </h2>
      </div>
    );
  };

  // -------------------------------------------------------------

  // --- MOTOR INTELIGENTE DA GRADE CURRICULAR (FUZZY MATCH) ---
  const normalizar = (str = '') => {
    const artigos = new RegExp('^(o|a|os|as|um|uma|the|an|de|do|da|dos|das)\\s+', 'i');
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(artigos, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Tela de abertura enquanto o login é conferido e os dados chegam. Sem
  // ela, quem já estava logado via a tela de login piscar por um instante
  // e depois o diário vazio, antes do conteúdo aparecer.
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: isDark ? 'linear-gradient(135deg, var(--bg-dark) 0%, #16213e 100%)' : 'linear-gradient(135deg, var(--parchment) 0%, var(--bg-light-alt) 100%)' }}>
        <BookOpen size={44} color="var(--t-accent)" className="splash-pulse" />
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: '1.2rem', letterSpacing: '0.08em', color: 'var(--t-text-muted)' }}>Diário Filosófico</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, var(--parchment) 0%, var(--bg-light-alt) 100%)', fontFamily: 'Georgia, serif' }}>
        
        {/* CABEÇALHO DA LANDING PAGE */}
        <header style={{ padding: '1.5rem 2rem', background: 'rgba(255, 255, 255, 0.5)', borderBottom: '1px solid rgba(139, 115, 85, 0.2)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BookOpen size={32} color="var(--umber-soft)" />
            <h1 style={{ margin: 0, color: 'var(--ink)', fontSize: '1.5rem', fontWeight: 'bold' }}>Diário Filosófico</h1>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL (VITRINE + LOGIN) */}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div style={{ maxWidth: '1200px', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4rem', alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* LADO DIREITO: O FORMULÁRIO DE LOGIN (INTACTO) */}
            <div style={{ flex: '1 1 300px', minWidth: 0, maxWidth: '450px', margin: '0 auto' }}>
              <div style={{ background: 'white', padding: '2.5rem 2rem', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(139, 115, 85, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: "'Cinzel', serif", color: 'var(--ink)', fontSize: '1.8rem' }}>{isLogin ? 'Bem-vindo de volta' : 'Iniciar Jornada'}</h2>
                  <p style={{ color: 'var(--umber-muted)', fontSize: '0.95rem', margin: 0 }}>Entre para acessar seus registros</p>
                </div>

                <form onSubmit={handleAuth}>
                  <input type="email" placeholder="Seu E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.85rem', marginBottom: '1rem', border: '2px solid var(--bg-light-alt)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', transition: 'border-color 0.3s', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = 'var(--umber-soft)'} onBlur={(e) => e.target.style.borderColor = 'var(--bg-light-alt)'} />
                  <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <input type={showPassword ? 'text' : 'password'} placeholder="Sua Senha" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.85rem', paddingRight: '3rem', border: '2px solid var(--bg-light-alt)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', transition: 'border-color 0.3s', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = 'var(--umber-soft)'} onBlur={(e) => e.target.style.borderColor = 'var(--bg-light-alt)'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {showPassword ? <EyeOff size={20} color="var(--umber-soft)" /> : <Eye size={20} color="var(--umber-soft)" />}
                    </button>
                  </div>
                  
                  {error && <div className="animate-fadeIn" style={{ background: '#fee', color: '#c33', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid #fcc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={16} /> {error}</div>}
                  
                  <button type="submit" style={{ width: '100%', padding: '0.85rem', background: 'var(--umber)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', fontFamily: 'Georgia, serif', transition: 'background 0.2s, transform 0.1s' }} onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.target.style.transform = 'scale(1)'}>{isLogin ? 'Acessar Diário' : 'Criar Nova Conta'}</button>
                  <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{ width: '100%', padding: '0.85rem', background: 'transparent', color: 'var(--umber)', border: '2px solid var(--umber-soft)', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = 'rgba(139, 115, 85, 0.05)'} onMouseOut={(e) => e.target.style.background = 'transparent'}>{isLogin ? 'Não tem conta? Cadastre-se' : 'Já tenho conta'}</button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: '#a89c8a' }}><div style={{ flex: 1, height: '1px', background: 'var(--bg-light-alt)' }}></div><span style={{ padding: '0 1rem', fontSize: '0.85rem', fontStyle: 'italic' }}>ou continue com</span><div style={{ flex: 1, height: '1px', background: 'var(--bg-light-alt)' }}></div></div>
                  
                  <button type="button" onClick={handleGoogleLogin} style={{ width: '100%', padding: '0.85rem', background: 'var(--white)', color: '#444', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = 'var(--gray-bg)'} onMouseOut={(e) => e.target.style.background = 'var(--white)'}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style={{ width: '20px', height: '20px' }} /> Entrar com Google
                  </button>
                </form>
              </div>
            </div>

            {/* LADO ESQUERDO: CONTEÚDO PARA O GOOGLE ADSENSE E NOVOS USUÁRIOS */}
            <div style={{ flex: '1 1 500px', color: 'var(--ink)' }}>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontFamily: "'Cinzel', serif", marginBottom: '1.5rem', lineHeight: '1.2', color: '#4a3320' }}>
                Conhece-te a ti mesmo.
              </h2>
              <p style={{ fontSize: '1.15rem', lineHeight: '1.8', color: '#5c4632', marginBottom: '1.5rem' }}>
                O <strong>Diário Filosófico</strong> é um ambiente digital minimalista inspirado nas práticas de autoexame das escolas de sabedoria clássica. Desenvolvido para auxiliar no forjamento do caráter, ele permite que você registre suas reflexões, avalie seus erros e cultive a clareza mental diariamente.
              </p>
              
              <blockquote style={{ borderLeft: '4px solid var(--umber-soft)', paddingLeft: '1.5rem', margin: '2rem 0', fontStyle: 'italic', fontSize: '1.2rem', color: 'var(--umber-muted)' }}>
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
                    <strong style={{ display: 'block', color: 'var(--umber-soft)', marginBottom: '0.25rem' }}>{v.nome}</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--umber-muted)' }}>{v.desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            

          </div>
        </main>

        {/* RODAPÉ SIMPLES PARA O ROBÔ */}
        <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--umber-soft)', fontSize: '0.9rem', borderTop: '1px solid rgba(139, 115, 85, 0.2)' }}>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} Diário Filosófico. Desenvolvido para a clareza e autoconhecimento.</p>
        </footer>

        
      </div>
    );
  }

  // --- A ANTE-SALA DE ESPERA (GUARDIÃO DA PORTA) ---
  if (user && fvAccessStatus !== 'approved') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: isDark ? 'linear-gradient(135deg, var(--bg-dark) 0%, #16213e 100%)' : 'linear-gradient(135deg, var(--parchment) 0%, var(--bg-light-alt) 100%)', fontFamily: 'Georgia, serif', color: 'var(--t-text)' }}>
        <header style={{ padding: '1.5rem 2rem', background: isDark ? 'rgba(26, 26, 46, 0.9)' : 'rgba(255, 255, 255, 0.5)', borderBottom: `1px solid var(--t-divider)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Shield size={32} color={'var(--t-accent-soft)'} />
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif" }}>Acesso Restrito</h1>
          </div>
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: 'transparent', border: `1px solid var(--t-accent-soft)`, color: 'var(--t-accent-soft)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={16} /> Sair
          </button>
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(0,0,0,0.4)' : 'white', padding: '2.5rem 2rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid var(--t-accent-soft)`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
            
            {fvAccessStatus === 'pending' ? (
              <>
                <Clock size={56} color={'var(--t-accent-bright)'} style={{ margin: '0 auto 1.5rem' }} />
                <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", fontSize: '1.6rem' }}>Em Análise</h2>
                <p style={{ lineHeight: '1.6', color: 'var(--t-text-muted)', marginBottom: '2rem' }}>
                  Sua solicitação foi enviada. O instrutor responsável verificará seus dados e liberará o acesso à plataforma em breve.
                </p>
                <div style={{ padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.1)', borderRadius: '8px', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Verifique novamente mais tarde.
                </div>
              </>
            ) : (
              <>
                <Lock size={56} color={'var(--t-accent-soft)'} style={{ margin: '0 auto 1.5rem' }} />
                <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", fontSize: '1.6rem' }}>Identifique-se</h2>
                <p style={{ lineHeight: '1.6', color: 'var(--t-text-muted)', marginBottom: '2rem' }}>
                  Esta é uma ferramenta de uso interno. Para solicitar a liberação do seu perfil, preencha os dados abaixo.
                </p>

                <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>Nome Completo</label>
                  <input type="text" value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="Seu nome..." style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: `1px solid var(--t-field-border)`, background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                </div>

                <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>E-mail de Acesso</label>
                  <input type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} placeholder="seuemail@exemplo.com" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: `1px solid var(--t-field-border)`, background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: 'var(--t-text-muted)', fontStyle: 'italic' }}>Esse é o e-mail que você vai usar para entrar no Diário — confirme que está certo.</p>
                </div>

                <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>Unidade (Sede/Filial)</label>
                  {availableUnits.length > 0 ? (
                    <select value={requestUnit} onChange={(e) => setRequestUnit(e.target.value)} style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: `1px solid var(--t-field-border)`, background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                      <option value="">Selecione sua unidade...</option>
                      {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={requestUnit} onChange={(e) => setRequestUnit(e.target.value)} placeholder="Ex: Sede Nacional..." style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: `1px solid var(--t-field-border)`, background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                  )}
                </div>

                <button onClick={handleRequestAccess} style={{ width: '100%', padding: '1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
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
  const praticasHojeCount = Object.values(todayFvDaily.praticas || {}).filter(v => v === true).length;
  const totalPraticasCount = fvConfig?.praticas?.length || 4;
  const pb = getPraticasBadgeInfo(statsMenu.diasPraticas);
  const PraticaIcon = pb.icon;
  const todayKeyBadge = getTodayKey();
  const todayEntryBadge = entries.find(e => e.date === todayKeyBadge);
  const praticasDeHoje = todayEntryBadge?.fvDaily?.praticas
    ? Object.values(todayEntryBadge.fvDaily.praticas).filter(v => v === true).length
    : 0;
  const totalPraticasConfig = (fvConfig?.praticas?.length || 4) + 4;
  const todayGdveStatus = todayEntryBadge?.fvDaily?.gdveTasksStatus || {};
  const missoesCompletas = fvGdveTasks.filter(t => t.isCycle ? !!fvGdveCycleStatus[t.id] : ((todayFvDaily.gdveTasksStatus?.[t.id] || 0) >= (t.target || 1))).length;

  return (
    <div style={{ minHeight: '100vh', background: isDark ? 'linear-gradient(135deg, var(--bg-dark) 0%, #16213e 100%)' : 'linear-gradient(135deg, var(--parchment) 0%, var(--bg-light-alt) 100%)', fontFamily: 'Georgia, serif', transition: 'background 0.3s ease' }}>
      {isOffline && (
        <div style={{ position: 'sticky', top: 0, zIndex: 101, background: 'var(--orange-strong)', color: 'white', textAlign: 'center', padding: '0.4rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
          Você está offline — suas anotações continuam sendo salvas neste aparelho e serão sincronizadas assim que a internet voltar.
        </div>
      )}
      <header style={{ padding: '1rem 2rem', borderBottom: `2px solid var(--t-accent)`, background: isDark ? 'rgba(26, 26, 46, 0.95)' : 'rgba(240, 230, 210, 0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* LOGO */}
          <div onClick={handleLogoClick} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <BookOpen size={32} color={'var(--t-accent)'} />
            <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(1rem, 3.5vw, 1.5rem)', color: 'var(--t-text)', fontWeight: 700 }}>
              Diário Filosófico <span style={{ fontWeight: 'normal', fontStyle: 'italic', fontSize: '0.85em', opacity: 0.9 }}>de {getUserFirstName()}</span>
            </h1>
          </div>

          {/* CONTROLES CONDICIONAIS (PC vs CELULAR) */}
          {isMobile ? (
            // VERSÃO CELULAR (Badges Interativos + Menu)
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              
              <div onClick={() => setShowStreakModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.5rem', background: streak > 0 ? (isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'), border: `1px solid ${streak > 0 ? (isDark ? 'var(--orange)' : 'var(--orange-soft)') : 'var(--t-field-border)'}`, borderRadius: '12px', color: streak > 0 ? 'var(--t-orange-text)' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                <StreakIcon size={14} fill={streak > 0 ? (isDark ? 'var(--orange)' : 'var(--orange-strong)') : 'none'} /> {streak}
              </div>

              <div onClick={() => setShowPracticesModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.5rem', background: isDark ? 'rgba(0,0,0,0.3)' : 'var(--bg-light)', border: `1px solid ${pb.color}`, borderRadius: '12px', color: pb.color, fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
                <PraticaIcon size={14} /> <span>{pb.label}</span>
              </div>

              {fvUnlocked && fvGdveTasks.length > 0 && (
                <div onClick={() => setShowQuickFv(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.5rem', background: missoesCompletas === fvGdveTasks.length ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : 'var(--bg-light)'), border: `1px solid ${missoesCompletas === fvGdveTasks.length ? 'var(--success)' : 'var(--t-field-border)'}`, borderRadius: '12px', color: missoesCompletas === fvGdveTasks.length ? 'var(--success)' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <Shield size={14} /> <span>{missoesCompletas}</span>
                </div>
              )}
              
              <button onClick={() => setIsMobileMenuOpen(true)} style={{ position: 'relative', padding: '0.3rem', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '0.2rem' }}>
                <Menu size={28} color={'var(--t-accent)'} />
                {isAdmin && pendingRequests.length > 0 && (
                  <span style={{ position: 'absolute', top: '0', right: '0', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--danger)', border: `2px solid var(--t-page-bg)` }} />
                )}
              </button>
            </div>
          ) : (
            // VERSÃO COMPUTADOR (Badges Interativos + Menu Agrupado)
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              
              <div onClick={() => setShowStreakModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: streak > 0 ? (isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'), border: `1px solid ${streak > 0 ? (isDark ? 'var(--orange)' : 'var(--orange-soft)') : 'var(--t-field-border)'}`, borderRadius: '20px', color: streak > 0 ? 'var(--t-orange-text)' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontFamily: 'Georgia, serif', fontSize: '0.85rem', cursor: 'pointer', boxShadow: streak > 0 && isDark ? '0 0 10px rgba(255, 152, 0, 0.2)' : 'none' }}>
                <StreakIcon size={16} fill={streak > 0 ? (isDark ? 'var(--orange)' : 'var(--orange-strong)') : 'none'} />
                <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
              </div>

              <div onClick={() => setShowPracticesModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: isDark ? 'rgba(0,0,0,0.3)' : 'var(--bg-light)', border: `1px solid ${pb.color}`, borderRadius: '20px', color: pb.color, fontWeight: 'bold', fontFamily: 'Georgia, serif', fontSize: '0.85rem', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform='scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform='scale(1)'}>
                <PraticaIcon size={16} /> <span>{pb.label}</span>
              </div>

              {fvUnlocked && fvGdveTasks.length > 0 && (
                <div onClick={() => setShowQuickFv(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: missoesCompletas === fvGdveTasks.length ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : 'var(--bg-light)'), border: `1px solid ${missoesCompletas === fvGdveTasks.length ? 'var(--success)' : 'var(--t-field-border)'}`, borderRadius: '20px', color: missoesCompletas === fvGdveTasks.length ? 'var(--success)' : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontFamily: 'Georgia, serif', fontSize: '0.85rem', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform='scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform='scale(1)'}>
                  <Shield size={16} /> <span>{missoesCompletas}/{fvGdveTasks.length}</span>
                </div>
              )}

              {/* BOTÃO MENU DROPDOWN */}
              <div style={{ position: 'relative', marginLeft: '0.5rem' }} onMouseLeave={() => setShowDiaryMenu(false)}>
                <button onMouseEnter={() => setShowDiaryMenu(true)} onClick={() => setShowDiaryMenu(!showDiaryMenu)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--t-accent)', border: `2px solid var(--t-accent)`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Menu size={16} /> Menu <ChevronDown size={14} />
                </button>
                {showDiaryMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: '0.5rem', zIndex: 1000 }}>
                    <div className="animate-fadeIn" style={{ width: '200px', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'white', border: `1px solid ${isDark ? 'var(--gold)' : 'var(--border-light)'}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
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
                          <button key={btn.id} onClick={() => { setView(btn.id); setShowDiaryMenu(false); }} style={{ padding: '0.8rem', background: isActive ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(139,115,85,0.1)') : 'transparent', border: 'none', borderBottom: '1px solid rgba(139, 115, 85, 0.1)', color: 'var(--t-text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: isActive ? 'bold' : 'normal' }}>
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
                <button onMouseEnter={() => setShowProfileMenu(true)} onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ position: 'relative', padding: '0.5rem', background: 'transparent', border: `2px solid var(--t-accent)`, borderRadius: '8px', cursor: 'pointer' }}>
                  <Settings size={18} color={'var(--t-accent)'} />
                  {isAdmin && pendingRequests.length > 0 && (
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--danger)', border: `2px solid var(--t-surface)` }} />
                  )}
                </button>
                {showProfileMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: '0.5rem', zIndex: 1000 }}>
                    <div className="animate-fadeIn" style={{ width: '180px', background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'white', border: `1px solid ${isDark ? 'var(--gold)' : 'var(--border-light)'}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                      <button onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); }} style={{ padding: '0.8rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(139, 115, 85, 0.1)', color: 'var(--t-text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings size={16}/> Configurações</button>
                      {isAdmin && (
                        <button onClick={() => { setShowAdminPanel(true); setShowProfileMenu(false); }} style={{ padding: '0.8rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(139, 115, 85, 0.1)', color: 'var(--t-text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldAlert size={16}/> Pedidos de Acesso</span>
                          {pendingRequests.length > 0 && <span style={{ background: 'var(--danger)', color: 'white', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 'bold' }}>{pendingRequests.length}</span>}
                        </button>
                      )}
                      <button onClick={() => { toggleTheme(); setShowProfileMenu(false); }} style={{ padding: '0.8rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(139, 115, 85, 0.1)', color: 'var(--t-text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{isDark ? <Sun size={16}/> : <Moon size={16}/>} {isDark ? 'Tema Claro' : 'Tema Escuro'}</button>
                      <button onClick={handleLogout} style={{ padding: '0.8rem', background: 'rgba(231, 76, 60, 0.1)', border: 'none', color: 'var(--danger)', textAlign: 'left', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><LogOut size={16}/> Sair</button>
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
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2rem', borderBottom: `1px solid var(--t-divider)`, marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', color: 'var(--t-accent)', fontSize: '1.5rem' }}>Menu</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}><X size={32} /></button>
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
                    style={{ width: '100%', padding: '1rem', textAlign: 'left', background: isActive ? 'var(--t-divider)' : 'transparent', color: isActive ? (isDark ? 'var(--gold-bright)' : 'var(--umber)') : 'var(--t-text)', border: `1px solid ${isActive ? 'var(--t-accent)' : 'transparent'}`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: isActive ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  >
                    {item.icon} {item.label}
                  </button>
                );
              })}

              <button onClick={() => { setIsMobileMenuOpen(false); setActivePracticeId('tratack'); setPracticePhase('intro'); setIsPracticeActive(true); }} style={{ width: '100%', padding: '1rem', textAlign: 'left', background: 'transparent', color: 'var(--t-text)', border: '1px solid transparent', borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Target size={22} color={'var(--t-text)'} /> Fazer Tratak
              </button>
            </div>

            <div style={{ marginTop: '4rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '2rem', borderTop: `1px solid var(--t-divider)` }}>
              <button onClick={() => { setShowSuggestionModal(true); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1rem', background: 'transparent', color: 'var(--t-accent)', border: `2px solid var(--t-accent)`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} /> Enviar Sugestão
              </button>
              
              <button onClick={() => { setShowSettingsModal(true); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1rem', background: 'transparent', color: 'var(--t-accent)', border: `2px solid var(--t-accent)`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Settings size={20} /> Configurações
              </button>

              {isAdmin && (
                <button onClick={() => { setShowAdminPanel(true); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1rem', background: 'transparent', color: 'var(--t-accent)', border: `2px solid var(--t-accent)`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={20} /> Pedidos de Acesso {pendingRequests.length > 0 && `(${pendingRequests.length})`}
                </button>
              )}

              <button onClick={handleLogout} style={{ width: '100%', padding: '1rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', background: selectedDate !== getTodayKey() ? (isDark ? 'rgba(231, 76, 60, 0.15)' : 'rgba(231, 76, 60, 0.1)') : (isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.4)'), borderRadius: '12px', border: `2px solid ${selectedDate !== getTodayKey() ? 'var(--danger)' : 'var(--t-divider-strong)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Calendar size={28} color={'var(--t-accent)'} />
                <div>
                  <h2 style={{ margin: 0, fontWeight: 'bold', color: 'var(--t-accent)', fontFamily: "'Cinzel', serif", fontSize: '1.4rem' }}>
                    {selectedDate === getTodayKey() ? "Hoje" : "Registro Histórico"}
                  </h2>
                  <p style={{ margin: '0.2rem 0 0 0', color: 'var(--t-text-muted)', fontSize: '0.9rem' }}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--t-field-bg)', border: `1px solid ${isDark ? 'var(--gold)' : 'var(--border-light)'}`, borderRadius: '8px', padding: '0.2rem' }}>
                      <button
                        onClick={() => {
                          if (selectedDate <= getMinEditableDateKey()) return;
                          const d = new Date(selectedDate + 'T12:00:00');
                          d.setDate(d.getDate() - 1);
                          handleDateChange(d.toISOString().split('T')[0]);
                        }}
                        disabled={selectedDate <= getMinEditableDateKey()}
                        style={{ background: 'transparent', border: 'none', color: selectedDate <= getMinEditableDateKey() ? 'var(--t-field-border)' : (isDark ? 'var(--gold)' : 'var(--ink)'), cursor: selectedDate <= getMinEditableDateKey() ? 'not-allowed' : 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Dia Anterior"
                      >
                        <ChevronLeft size={20} />
                      </button>

                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        max={getTodayKey()}
                        min={getMinEditableDateKey()}
                        style={{ background: 'transparent', color: 'var(--t-text)', border: 'none', padding: '0.5rem', fontSize: '1rem', fontFamily: 'Georgia, serif', outline: 'none', cursor: 'pointer' }}
                      />

                      <button 
                        onClick={() => {
                          if (selectedDate >= getTodayKey()) return; 
                          const d = new Date(selectedDate + 'T12:00:00');
                          d.setDate(d.getDate() + 1);
                          handleDateChange(d.toISOString().split('T')[0]);
                        }}
                        style={{ background: 'transparent', border: 'none', color: selectedDate >= getTodayKey() ? 'var(--t-field-border)' : (isDark ? 'var(--gold)' : 'var(--ink)'), cursor: selectedDate >= getTodayKey() ? 'not-allowed' : 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Próximo Dia"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    {selectedDate !== getTodayKey() && (
                      <button onClick={() => handleDateChange(getTodayKey())} style={{ padding: '0.6rem 1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Voltar a Hoje</button>
                    )}
                  </div>
            </div>

            {/* CITAÇÃO */}
            {dailyQuote && (
              <div style={{ padding: '2rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.6)', borderRadius: '12px', borderLeft: `4px solid var(--t-accent-soft)`, fontStyle: 'italic' }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--t-text)', margin: '0 0 1rem 0', lineHeight: '1.6' }}>"{dailyQuote.text}"</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--t-text-muted)', margin: 0, textAlign: 'right', fontWeight: 'bold' }}>— {dailyQuote.author}</p>
              </div>
            )}

            {/* PRÁTICAS DE HOJE (Tarefas extras) */}
            {getTasksForToday().length > 0 && (
              <div style={{ background: 'var(--t-surface-soft)', padding: '1.5rem', borderRadius: '16px', border: `2px solid var(--t-divider-strong)` }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--t-text)' }}>✓ Desafios Diários</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {getTasksForToday().map(task => (
                    <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <input type="checkbox" checked={todayTasksStatus[task.id] || false} onChange={() => toggleTaskStatus(task.id)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                      <span style={{ color: 'var(--t-text)', textDecoration: todayTasksStatus[task.id] ? 'line-through' : 'none', opacity: todayTasksStatus[task.id] ? 0.6 : 1 }}>{task.name}</span>
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
                background: isOpen ? 'transparent' : (status === 'full' ? 'transparent' : (status === 'partial' ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : (isDark ? 'rgba(0,0,0,0.2)' : 'var(--bg-light)')))
              });

              // Montador de Títulos Inteligentes
              const renderTitle = (text, status, isOpen, icon) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {icon}
                  <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', color: 'var(--t-text)', fontFamily: "'Cinzel', serif", textDecoration: status === 'full' && !isOpen ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {text}
                    {status === 'partial' && !isOpen && <span style={{fontSize: '0.8rem', opacity: 0.8, fontStyle: 'italic', fontFamily: 'Georgia, serif'}}>(Em Andamento)</span>}
                  </h2>
                </div>
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* BLOCO 1: PRÓLOGO MATINAL */}
                  <div style={getBlockStyle(prologoStatus, isPrologoOpen, 'var(--t-divider-strong)')}>
                    <div onClick={() => setIsPrologoOpen(!isPrologoOpen)} style={getHeaderStyle(prologoStatus, isPrologoOpen)}>
                      {renderTitle('Prólogo Matinal', prologoStatus, isPrologoOpen, <Sunrise size={28} color={isDark ? '#ffd966' : 'var(--orange)'} />)}
                      {isPrologoOpen ? <ChevronUp size={24} color={'var(--t-text)'} /> : <ChevronDown size={24} color={'var(--t-text)'} />}
                    </div>

                    {isPrologoOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                        {morningDone ? (
                          <div style={{ padding: '1.5rem', background: isDark ? 'rgba(76, 175, 80, 0.1)' : '#e8f5e9', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.3)' : 'var(--success)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={24} color={isDark ? 'var(--success-soft)' : 'var(--success)'} />
                                <h3 style={{ margin: 0, color: 'var(--t-success-text)' }}>Armadura Colocada!</h3>
                              </div>
                              <button onClick={() => setMorningDone(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t-success-text)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 'bold' }}><Edit size={16} /> Editar</button>
                            </div>
                            <p style={{ margin: '0.5rem 0', color: isDark ? '#c8e6c9' : '#1b5e20' }}><strong>Virtude do dia:</strong> {selectedVirtue || customVirtue}</p>
                            {dailyIntention && <p style={{ margin: '0.5rem 0', color: isDark ? '#c8e6c9' : '#1b5e20' }}><strong>Compromisso:</strong> {dailyIntention}</p>}
                          </div>
                        ) : (
                          <div>
                            <div style={{ marginBottom: '1.5rem' }}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-text)' }}>Virtude do Dia:</label>
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                <button onClick={selectRandomVirtue} disabled={!canDrawToday() || isDrawingVirtue} style={{ padding: '0.75rem 1.5rem', background: (canDrawToday() && !isDrawingVirtue) ? 'var(--t-accent)' : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'), color: (canDrawToday() && !isDrawingVirtue) ? 'white' : (isDark ? 'var(--gray)' : '#999'), border: 'none', borderRadius: '8px', cursor: (canDrawToday() && !isDrawingVirtue) ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
                                  <Shuffle size={18} className={isDrawingVirtue ? 'animate-spin' : ''} /> {isDrawingVirtue ? 'Sorteando...' : (canDrawToday() ? 'Sortear Virtude' : 'Já sorteou hoje')}
                                </button>
                                <button onClick={() => setShowCustomVirtue(!showCustomVirtue)} disabled={isDrawingVirtue} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: 'var(--t-accent)', border: `2px solid var(--t-accent)`, borderRadius: '8px', cursor: isDrawingVirtue ? 'default' : 'pointer', opacity: isDrawingVirtue ? 0.5 : 1, fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
                                  {showCustomVirtue ? 'Escolher da Lista' : 'Escrever Própria'}
                                </button>
                              </div>

                              {isDrawingVirtue && (
                                <div className="virtue-roulette-text" style={{ padding: '1rem', marginBottom: '1rem', textAlign: 'center', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.5)', borderRadius: '8px', border: `1px dashed var(--t-accent)` }}>
                                  <h4 style={{ margin: 0, color: 'var(--t-accent)', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>✨ {virtueDrawDisplay} ✨</h4>
                                </div>
                              )}

                              {!isDrawingVirtue && (showCustomVirtue ? (
                                <DeferredField as="input" type="text" placeholder="Digite sua virtude..." value={customVirtue} onCommit={setCustomVirtue} style={{ width: '100%', padding: '0.75rem', border: `2px solid var(--t-gold-border)`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                              ) : (
                                <select value={selectedVirtue} onChange={(e) => setSelectedVirtue(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `2px solid var(--t-gold-border)`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: 'var(--t-surface-glass)', color: 'var(--t-text)' }}>
                                  <option value="">Selecione uma virtude...</option>
                                  {virtues.map((v, idx) => <option key={idx} value={v.name}>{v.name}</option>)}
                                </select>
                              ))}

                              {!isDrawingVirtue && selectedVirtue && !showCustomVirtue && (
                                <div key={selectedVirtue} className="virtue-pop-reveal" onClick={() => setIsTodayVirtueExpanded(!isTodayVirtueExpanded)} style={{ marginTop: '1rem', padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.5)', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}`, cursor: 'pointer' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: '0', color: 'var(--t-accent)', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>{selectedVirtue}</h4>
                                    {isTodayVirtueExpanded ? <ChevronUp size={20} color={'var(--t-accent)'} /> : <ChevronDown size={20} color={'var(--t-accent)'} />}
                                  </div>
                                  
                                  {/* A DESCRIÇÃO CURTA DE VOLTA AQUI */}
                                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: 'var(--t-text-tan)', fontStyle: 'italic' }}>
                                    {virtues.find(v => v.name === selectedVirtue)?.shortDesc}
                                  </p>

                                  {isTodayVirtueExpanded && (
                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid var(--t-divider)` }}>
                                      <p style={{ fontSize: '0.95rem', color: 'var(--t-text)', marginBottom: '1rem', lineHeight: '1.6' }}>{virtues.find(v => v.name === selectedVirtue)?.description}</p>
                                      <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-accent)' }}>Práticas Sugeridas:</h5>
                                      <p style={{ fontSize: '0.9rem', color: 'var(--t-text-tan)', margin: 0, whiteSpace: 'pre-line' }}>{virtues.find(v => v.name === selectedVirtue)?.practices}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-text)' }}>Meu compromisso prático para hoje:</label>
                              <DeferredField value={dailyIntention} onCommit={setDailyIntention} placeholder="Como e quando exatamente eu vou praticar isso hoje?" rows={3} style={{ width: '100%', padding: '0.75rem', border: `2px solid var(--t-gold-border)`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: 'var(--t-surface-glass)', color: 'var(--t-text)', resize: 'vertical' }} />
                            </div>

                            <button onClick={saveMorning} style={{ width: '100%', padding: '1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              <CheckCircle size={20} /> Firmar Compromisso
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BLOCO 2: AS PRÁTICAS DO TEMPLO (MÓDULO FV) */}
                  {fvUnlocked && fvConfig && (
                    <div style={getBlockStyle(forjaStatus, isPraticasOpen, 'var(--gold-bright)')}>
                      <div onClick={() => setIsPraticasOpen(!isPraticasOpen)} style={getHeaderStyle(forjaStatus, isPraticasOpen)}>
                        {renderTitle('Práticas (A Forja do Caráter)', forjaStatus, isPraticasOpen, <Award size={28} color="var(--gold-bright)" />)}
                        {isPraticasOpen ? <ChevronUp size={24} color={'var(--t-accent-bright)'} /> : <ChevronDown size={24} color={'var(--t-accent-bright)'} />}
                      </div>
                      
                      {isPraticasOpen && (
                        <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {fvConfig.praticas.map(prac => (
                              <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: fvDaily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'), border: `1px solid ${fvDaily.praticas?.[prac.key] ? 'var(--success)' : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'var(--border-light)')}`, borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                {fvDaily.praticas?.[prac.key] ? <CheckCircle size={20} color="var(--success)" /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${isDark ? 'var(--gold-muted)' : '#999'}` }}></div>}
                                <span style={{ color: fvDaily.praticas?.[prac.key] ? 'var(--t-success-text)' : 'var(--t-text)', fontSize: '1.05rem', fontWeight: fvDaily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--gold-bright)', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--t-accent)', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>Templo Interior</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                              {[
                                { key: 'porta', label: '1. Porta' },
                                { key: 'patioAberto', label: '2. Pátio Aberto' },
                                { key: 'patioColunas', label: '3. Pátio de Colunas' },
                                { key: 'santuario', label: '4. Santuário' }
                              ].map(prac => (
                                <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.8rem', background: fvDaily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : 'transparent', border: `1px solid ${fvDaily.praticas?.[prac.key] ? 'var(--success)' : 'var(--t-divider)'}`, borderRadius: '8px', transition: 'all 0.2s' }}>
                                  {fvDaily.praticas?.[prac.key] ? <CheckCircle size={18} color="var(--success)" /> : <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${isDark ? 'var(--gold-muted)' : '#999'}` }}></div>}
                                  <span style={{ color: fvDaily.praticas?.[prac.key] ? 'var(--t-success-text)' : 'var(--t-text-tan)', fontSize: '1rem', fontWeight: fvDaily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <button onClick={saveFvPractices} style={{ width: '100%', padding: '1rem', background: 'transparent', color: 'var(--t-accent-bright)', border: '2px solid var(--gold-bright)', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <Save size={20} /> Salvar Práticas Realizadas
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BLOCO 3: A ESCALADA (AS REFLEXÕES DO FV) */}
                  {fvUnlocked && fvConfig && (
                    <div style={getBlockStyle(escaladaStatus, isEscaladaOpen, 'var(--gold-bright)')}>
                      <div onClick={() => setIsEscaladaOpen(!isEscaladaOpen)} style={getHeaderStyle(escaladaStatus, isEscaladaOpen)}>
                        {renderTitle('Degrau (A Escalada)', escaladaStatus, isEscaladaOpen, <Mountain size={28} color={'var(--t-accent-bright)'} />)}
                        {isEscaladaOpen ? <ChevronUp size={24} color={'var(--t-accent-bright)'} /> : <ChevronDown size={24} color={'var(--t-accent-bright)'} />}
                      </div>

                      {isEscaladaOpen && (
                        <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                          <p style={{ color: 'var(--t-text-muted)', fontStyle: 'italic', marginBottom: '2rem', fontSize: '0.95rem' }}>Ao salvar, os itens preenchidos ficarão cinzas para descansar sua mente.</p>

                          {fvConfig.itensCarta.map(item => {
                            const isItem2 = item.id === 'item2';
                            const subKeys = ['instintos', 'idade', 'enfermidade', 'animo', 'humor', 'ideias', 'sentimentos', 'ambiente'];
                            const subLabels = ['Instintos (Conserv. / Procriação)', 'Idade', 'Enfermidade', 'Ânimo', 'Humor', 'Ideias', 'Sentimentos', 'Ambiente'];
                            
                            const isFilled = isItem2 
                              ? subKeys.some(k => (savedFvDaily[`item2_${k}`] || '').trim().length > 0)
                              : (savedFvDaily[item.id] || '').trim().length > 0;
                              
                            const actuallyExpanded = expandedCartaItems[item.id] !== undefined ? expandedCartaItems[item.id] : !isFilled;

                            const borderColor = isFilled ? 'var(--t-line-subtle)' : (isDark ? 'rgba(212, 175, 55, 0.5)' : 'var(--umber-bright)');
                            const headerColor = isFilled ? (isDark ? '#777' : '#aaa') : 'var(--t-accent-bright)';
                            const bgColor = isFilled ? (isDark ? 'rgba(0,0,0,0.1)' : 'var(--gray-bg)') : (isDark ? 'rgba(212, 175, 55, 0.05)' : 'white');

                            return (
                              <div key={item.id} style={{ marginBottom: '1rem', background: bgColor, borderRadius: '8px', border: `1px solid ${borderColor}`, transition: 'all 0.3s ease', overflow: 'hidden' }}>
                                <div 
                                  onClick={() => setExpandedCartaItems(prev => ({ ...prev, [item.id]: !actuallyExpanded }))}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', cursor: 'pointer', background: isFilled ? 'transparent' : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,245,220,0.3)') }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {isFilled && <CheckCircle size={18} color={isDark ? 'var(--gray-strong)' : '#aaa'} />}
                                    <h4 style={{ margin: 0, fontWeight: 600, fontSize: '1.05rem', color: headerColor, fontFamily: "'Cinzel', serif", textTransform: 'uppercase', textDecoration: isFilled ? 'line-through' : 'none' }}>
                                      {item.label}
                                    </h4>
                                  </div>
                                  {actuallyExpanded ? <ChevronUp size={20} color={headerColor} /> : <ChevronDown size={20} color={headerColor} />}
                                </div>

                                {actuallyExpanded && (
                                  <div className="animate-fadeIn" style={{ padding: '0 1.2rem 1.2rem 1.2rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--t-text-faint)', marginBottom: '1rem', fontStyle: 'italic' }}>{item.desc}</p>
                                    
                                    {isItem2 ? (
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                        {subKeys.map((subK, i) => (
                                          <div key={subK}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: isDark ? 'var(--gold)' : 'var(--umber-bright)', marginBottom: '0.4rem', fontWeight: 'bold' }}>{subLabels[i]}</label>
                                            <DeferredField 
                                              value={fvDaily[`item2_${subK}`] || ''} 
                                              onCommit={(v) => handleFvDailyTextChange(`item2_${subK}`, v)} 
                                              placeholder="Análise..." 
                                              rows={2} 
                                              style={{ width: '100%', padding: '0.75rem', border: `1px solid var(--t-line-subtle)`, borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'Georgia, serif', background: 'var(--t-field-bg)', color: 'var(--t-text)', resize: 'vertical' }} 
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <DeferredField 
                                        value={fvDaily[item.id] || ''} 
                                        onCommit={(v) => handleFvDailyTextChange(item.id, v)} 
                                        placeholder="Registro..." 
                                        rows={3} 
                                        style={{ width: '100%', padding: '1rem', border: `1px solid var(--t-line-subtle)`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: 'var(--t-field-bg)', color: 'var(--t-text)', resize: 'vertical' }} 
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <button onClick={saveFvTexts} style={{ width: '100%', padding: '1rem', background: 'rgba(255, 215, 0, 0.1)', color: 'var(--t-accent-bright)', border: '1px solid var(--gold-bright)', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', marginTop: '1rem' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,215,0,0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)'}>
                            <Save size={20} /> Salvar Relatos da Escalada
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BLOCO 4: EPÍLOGO NOTURNO */}
                  <div style={getBlockStyle(epilogoStatus, isEpilogoOpen, 'var(--t-divider-strong)')}>
                    <div onClick={() => setIsEpilogoOpen(!isEpilogoOpen)} style={getHeaderStyle(epilogoStatus, isEpilogoOpen)}>
                      {renderTitle('Epílogo Noturno', epilogoStatus, isEpilogoOpen, <Sunset size={28} color={isDark ? '#b19cd9' : '#9c27b0'} />)}
                      {isEpilogoOpen ? <ChevronUp size={24} color={'var(--t-text)'} /> : <ChevronDown size={24} color={'var(--t-text)'} />}
                    </div>

                    {isEpilogoOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                        {eveningDone ? (
                          <div style={{ padding: '1.5rem', background: isDark ? 'rgba(76, 175, 80, 0.1)' : '#e8f5e9', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.3)' : 'var(--success)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={24} color={isDark ? 'var(--success-soft)' : 'var(--success)'} />
                                <h3 style={{ margin: 0, color: 'var(--t-success-text)' }}>Paz Conquistada!</h3>
                              </div>
                              <button onClick={() => setEveningDone(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t-success-text)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', fontWeight: 'bold' }}><Edit size={16} /> Editar</button>
                            </div>
                            <p style={{ margin: 0, color: isDark ? '#c8e6c9' : '#1b5e20' }}>Exame noturno encerrado. Descanse com dignidade. 🌙</p>
                          
                          {/* EXIBE AS RESPOSTAS SE TIVER */}
                            {fvUnlocked && (savedEntryForToday.fvDaily?.aulaRegularPresenca || savedEntryForToday.fvDaily?.reuniaoRaioPresenca || savedEntryForToday.fvDaily?.aulaMinistradaPresenca) && (
                               <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.2)'}` }}>
                                 {savedEntryForToday.fvDaily?.aulaRegularPresenca && <p style={{ margin: '0.2rem 0', color: isDark ? '#a5d6a7' : 'var(--success-strong)', fontSize: '0.9rem' }}><strong>Aula Regular:</strong> {savedEntryForToday.fvDaily.aulaRegularPresenca}</p>}
                                 {savedEntryForToday.fvDaily?.reuniaoRaioPresenca && <p style={{ margin: '0.2rem 0', color: isDark ? '#a5d6a7' : 'var(--success-strong)', fontSize: '0.9rem' }}><strong>Reunião de Raio:</strong> {savedEntryForToday.fvDaily.reuniaoRaioPresenca}</p>}
                                 {savedEntryForToday.fvDaily?.aulaMinistradaPresenca && <p style={{ margin: '0.2rem 0', color: isDark ? '#a5d6a7' : 'var(--success-strong)', fontSize: '0.9rem' }}><strong>Aula Ministrada:</strong> {savedEntryForToday.fvDaily.aulaMinistradaPresenca}</p>}
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
                                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--t-purple-text)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <Clock size={18} /> Balanço de Serviço e Atividades
                                    </h4>
                                    
                                    {/* Perguntas Dinâmicas de Aula (Só aparecem se for o dia certo) */}
                                    {temAulaHoje && (
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: `1px dashed ${isDark ? 'rgba(155, 89, 182, 0.3)' : '#e1bee7'}` }}>
                                        {showAulaRegular && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--t-text)', fontWeight: 'bold' }}>Assistiu à Aula Regular?</label>
                                            <select value={fvDaily.aulaRegularPresenca || ''} onChange={(e) => handleFvDailyTextChange('aulaRegularPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid var(--t-purple-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, assisti</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                        {showReuniaoRaio && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--t-text)', fontWeight: 'bold' }}>Participou da Reunião de Raio?</label>
                                            <select value={fvDaily.reuniaoRaioPresenca || ''} onChange={(e) => handleFvDailyTextChange('reuniaoRaioPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid var(--t-purple-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, participei</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                        {showAulaMinistrada && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--t-text)', fontWeight: 'bold' }}>Ministrou sua Aula hoje?</label>
                                            <select value={fvDaily.aulaMinistradaPresenca || ''} onChange={(e) => handleFvDailyTextChange('aulaMinistradaPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid var(--t-purple-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, ministrei</option><option value="Não">Não</option>
                                            </select>
                                          </div>
                                        )}
                                        {showCrm && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--t-purple-text)', fontWeight: 'bold' }}>Esteve na CRM Mensal?</label>
                                            <select value={fvDaily.crmPresenca || ''} onChange={(e) => handleFvDailyTextChange('crmPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid var(--t-purple-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, estive</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                        {showEd && (
                                          <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#3498DB', fontWeight: 'bold' }}>Assistiu à Aula de ED?</label>
                                            <select value={fvDaily.aulaEdPresenca || ''} onChange={(e) => handleFvDailyTextChange('aulaEdPresenca', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.4)' : 'var(--border-light)'}`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                                              <option value="">Selecione...</option><option value="Sim">Sim, assisti</option><option value="Não">Não (Faltei)</option>
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Voluntariado Extra Livre (Sempre Visível) */}
                                    <div style={{ padding: '1rem', background: isDark ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.2)' : '#e1bee7'}` }}>
                                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--t-text)', fontWeight: 'bold' }}>Serviço / Voluntariado Extra Hoje?</label>
                                      <p style={{ fontSize: '0.8rem', color: 'var(--t-text-faint)', marginTop: '-0.3rem', marginBottom: '0.8rem', fontStyle: 'italic' }}>
                                        {temAulaHoje ? "As horas das aulas acima já são calculadas sozinhas. Informe aqui apenas horários avulsos (limpezas, manutenções, etc)." : "Informe aqui o tempo dedicado a serviços avulsos pela Escola hoje (limpeza, manutenções, secretaria, etc)."}
                                      </p>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input type="time" value={fvDaily.horasVoluntariado || ''} onChange={(e) => handleFvDailyTextChange('horasVoluntariado', e.target.value)} style={{ width: '120px', padding: '0.6rem', borderRadius: '6px', border: `1px solid var(--t-purple-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                                        {(fvDaily.horasVoluntariado && fvDaily.horasVoluntariado !== '') && (
                                           <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 'bold' }}>✓ Registrado</span>
                                        )}
                                      </div>
                                    </div>

                                  </div>
                                );
                              })()
                            )}

                            <p style={{ marginBottom: '1.5rem', color: 'var(--t-text-muted)', fontStyle: 'italic', fontSize: '1.05rem', borderLeft: `3px solid ${isDark ? '#b19cd9' : '#9c27b0'}`, paddingLeft: '1rem' }}>"Que ninguém durma sem antes examinar as ações do dia" — Versos de Ouro de Pitágoras</p>

                            <div style={{ marginBottom: '2rem' }}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-text)', fontSize: '1.1rem' }}>Reflexão Final:</label>
                              <p style={{ fontSize: '0.9rem', color: 'var(--t-text-faint)', marginBottom: '1rem' }}>Escreva livremente sobre as vitórias, derrotas e percepções de hoje antes de dormir.</p>
                              <DeferredField value={freeEpilogue} onCommit={setFreeEpilogue} placeholder="Ao olhar para o dia de hoje, percebo que..." rows={6} style={{ width: '100%', padding: '1rem', border: `1px solid var(--t-gold-border)`, borderRadius: '8px', fontSize: '1.05rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(0,0,0,0.2)' : 'var(--white)', color: 'var(--t-text)', resize: 'vertical', lineHeight: '1.6' }} />
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
          <Suspense fallback={<ViewFallback />}><GoalsView {...{ acceptedMissions, addProjectGoal, addVirtueGoal, isDark, newProjectGoal, newVirtueGoal, projectGoals, removeAcceptedMission, removeGoal, setNewProjectGoal, setNewVirtueGoal, toggleAcceptedMission, toggleGoal, virtueGoals }} /></Suspense>
        )}

        {/* VIEW: CENTRAL DE NOTIFICAÇÕES (O GUARDIÃO) */}
        {view === 'notifications' && (
          <Suspense fallback={<ViewFallback />}><NotificationsView {...{ isDark, notifSettings, saveBtnStatus, saveNotificationSettings, setNotifSettings, setView }} /></Suspense>
        )}

        {/* VIEW: LEITURAS E ESTUDOS */}
        {view === 'leituras' && (
          <Suspense fallback={<ViewFallback />}><LeiturasView {...{ bookSearchQuery, bookSearchResults, books, dailyStudyTip, editingBookId, expandedNotesId, favoriteTheme, finishedBooksCount, isDark, isMobile, isSearchingBooks, newBook, saveBooksToDb, searchBooks, selectedForDeletion, setBarcodeScanError, setBookSearchQuery, setBookSearchResults, setBooks, setEditingBookId, setExpandedNotesId, setNewBook, setSelectedForDeletion, setShelfSearchTerm, setShowAddBook, setShowBarcodeScanner, setShowReadBooks, shelfSearchTerm, showAddBook, showConfirm, showPrompt, showReadBooks, showToast, totalForgedPages }} /></Suspense>
        )}

        {/* SEÇÃO DA BIBLIOTECA DE VIRTUDES (AGORA FUNDIDA COM LEITURAS E EM GAVETA) */}
        {view === 'leituras' && (
          <Suspense fallback={<ViewFallback />}><VirtuesLibraryView {...{ fvUnlocked, getBlockStyle, getHeaderStyle, isDark, isVirtuesOpen, selectedVirtueDetail, setIsVirtuesOpen, setSelectedVirtueDetail }} /></Suspense>
        )}

        {/* VIEW: ANALYTICS (Métricas da Alma) */}
        {view === 'analytics' && (
          <Suspense fallback={<ViewFallback />}><AnalyticsView {...{ entries, isDark }} /></Suspense>
        )}

        {/* VIEW: DISCIPULADO */}
        {view === 'gdve' && fvUnlocked && (
          <Suspense fallback={<ViewFallback />}><GdveView {...{ addGdveTask, copyInviteLink, customTasks, deleteGroupHandler, editingGdveTaskId, fvCalendar, fvCondicao, fvDaily, fvGdveBastiaoName, fvGdveCycleStatus, fvGdveReuniao, fvGdveTasks, fvLastCartaDate, fvLastMeetingDate, fvMasterName, fvNextCartaDate, fvUnidade, generateMonthlyReportText, gerarCartaDegrau, getBlockStyle, getFvMonthlyStats, getHeaderStyle, getTaskColor, getTodayKey, handleDiasMinistradosToggle, handleMonthlyReportChange, handlePropagandaToggle, isDark, isGdveDesafiosOpen, isGdveMóduloOpen, isGdvePlanOpen, isGdveRelatorioOpen, isGeneratingCartaDegrau, isJoiningGroup, isLoadingGroups, joinGroupByCode, leaveGroupHandler, monthlyReport, myGroups, newGdveTaskCycleTouched, newGdveTaskIsCycle, newGdveTaskName, newGdveTaskTarget, newTaskName, registerGdveAttendance, removeCustomTask, removeGdveTask, removeGroupMember, saveCustomTask, saveFvPlanning, setEditingGdveTaskId, setFvCalendar, setFvCondicao, setFvGdveTasks, setFvLastCartaDate, setFvLastMeetingDate, setFvMasterName, setFvNextCartaDate, setFvUnidade, setIsGdveDesafiosOpen, setIsGdveMóduloOpen, setIsGdvePlanOpen, setIsGdveRelatorioOpen, setNewGdveTaskCycleTouched, setNewGdveTaskIsCycle, setNewGdveTaskName, setNewGdveTaskTarget, setNewTaskName, setShowCreateGroupModal, showConfirm, showPrompt, showToast, startEditingGdveTask, todayTasksStatus, toggleGdveTask, toggleTaskStatus, user }} /></Suspense>
        )}
        
        {/* VIEW: HISTORY */}
        {view === 'history' && (
          <Suspense fallback={<ViewFallback />}><HistoryView {...{ deleteEntry, entries, expandedEntryId, expandedMonths, expandedYears, exportFvReportTXT, exportToCSV, filteredEntries, fvUnlocked, handleDateChange, importDiary, isDark, searchTerm, setExpandedEntryId, setExpandedMonths, setExpandedYears, setSearchTerm, setView }} /></Suspense>
        )}

      {/* MODAL DO FOGO INTERNO (MEDIDA IDEAL + MOTIVACIONAL) */}
        {showStreakModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setShowStreakModal(false)}>
            <div style={{ background: 'var(--t-page-bg)', padding: '1.5rem', borderRadius: '16px', maxWidth: '380px', width: '100%', border: `2px solid ${isDark ? 'var(--orange)' : 'var(--orange-strong)'}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowStreakModal(false)} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <StreakIcon size={46} fill={isDark ? 'var(--orange)' : 'var(--orange-strong)'} color={isDark ? 'var(--orange)' : 'var(--orange-strong)'} style={{ margin: '0 auto 0.5rem' }} />
                <h2 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.5rem' }}>Fogo Interno</h2>
              </div>

              {/* CAIXA DO GRAU E PROGRESSO */}
              <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--white)', padding: '1.2rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.3)' : 'var(--orange-soft)'}`, textAlign: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', color: 'var(--t-orange-text)', display: 'block', marginBottom: '0.2rem' }}>Grau Atual</span>
                <h3 style={{ margin: '0 0 0.25rem', fontFamily: "'Cinzel', serif", fontSize: '1.4rem', color: 'var(--t-text)' }}>{streakInfo.current.title}</h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--t-text-muted)', fontStyle: 'italic' }}>"{streakInfo.current.desc}"</p>
                
                {streakInfo.next ? (
                  <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.2)' : 'rgba(230, 81, 0, 0.1)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--t-text-muted)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                      <span>Rumo a: {streakInfo.next.title}</span>
                      <span>Faltam {streakInfo.next.min - streak} dias</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-soft)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                      <div style={{ width: `${Math.min(100, (streak / streakInfo.next.min) * 100)}%`, height: '100%', background: isDark ? 'var(--orange)' : 'var(--orange-strong)', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--t-orange-text)' }}>🔥 Perseverança e Constância! Preencha todos os dias para forjar seu caráter.</p>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.2)' : 'rgba(230, 81, 0, 0.1)'}` }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--t-orange-text)', fontWeight: 'bold' }}>🌟 Você atingiu o mais alto grau de maestria e constância!</p>
                  </div>
                )}
              </div>

              {/* GRID COMPACTO DE 3 COLUNAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div style={{ background: isDark ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0', padding: '0.75rem 0.5rem', borderRadius: '10px', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.3)' : 'rgba(230, 81, 0, 0.2)'}` }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--t-orange-text)' }}>{streak}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--t-text-tan)', textTransform: 'uppercase', fontWeight: 'bold' }}>Atual</div>
                </div>
                <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.6)', padding: '0.75rem 0.5rem', borderRadius: '10px', textAlign: 'center', border: `1px solid var(--t-divider-strong)` }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--t-accent)' }}>{longestStreak}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--t-text-tan)', textTransform: 'uppercase', fontWeight: 'bold' }}>Recorde</div>
                </div>
                <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.5)' : 'white', padding: '0.75rem 0.5rem', borderRadius: '10px', textAlign: 'center', border: `1px solid var(--t-divider)` }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--t-accent)' }}>{entries.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--t-text-tan)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total</div>
                </div>
              </div>

            </div>
          </div>
        )}
        
        {/* MODAL DE SEGURANÇA */}
        {showInactivityWarning && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div style={{ background: 'var(--t-page-bg)', padding: '2.5rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid var(--danger)`, textAlign: 'center', boxShadow: '0 10px 40px rgba(231, 76, 60, 0.4)' }}>
              <AlertCircle size={56} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.5rem' }}>Você ainda está aí?</h2>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--t-text-muted)', fontSize: '1.1rem', lineHeight: '1.6' }}>Para sua segurança, o diário será fechado em <strong style={{ color: 'var(--danger)', fontSize: '1.3rem' }}>{logoutCountdown}</strong> segundos.</p>
              <p className="animate-fadeIn" style={{ margin: '0 0 1.5rem 0', color: 'var(--t-success-text)', fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> Fique tranquilo, seu progresso foi salvo automaticamente.</p>
              <button onClick={keepAlive} style={{ width: '100%', padding: '1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Continuar conectado</button>
            </div>
          </div>
        )}

{/* MODAL: CONVITE ATIVO DE NOTIFICAÇÃO */}
        {showNotificationPrompt && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '2.5rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: `2px solid var(--t-accent)`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
              <button onClick={() => setShowNotificationPrompt(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}><X size={24} /></button>
              
              <Bell size={56} color={'var(--t-accent)'} style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.5rem' }}>Mantenha a Chama Acesa!</h2>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--t-text-muted)', fontSize: '1.05rem', lineHeight: '1.6' }}>
                Ative os lembretes para não esquecer de fazer o seu Diário Filosófico e o Exame Noturno.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button onClick={() => { toggleNotifications(); setShowNotificationPrompt(false); }} style={{ width: '100%', padding: '1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <CheckCircle size={20} /> Ativar Lembretes
                </button>
                <button onClick={() => setShowNotificationPrompt(false)} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? 'var(--gold-muted)' : 'var(--umber)', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(107, 68, 35, 0.3)'}`, borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                  Agora não
                </button>
              </div>
            </div>
          </div>
        )}

{/* MODAL DE SUGESTÕES */}
        {showSuggestionModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '2rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid var(--t-accent)`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
              <button onClick={() => setShowSuggestionModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}><X size={24} /></button>
              
              <MessageSquare size={48} color={'var(--t-accent)'} style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.6rem' }}>Caixa de Ideias</h2>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--t-text-muted)', fontSize: '1rem', lineHeight: '1.5' }}>Encontrou um erro ou tem uma sugestão para melhorar nossa ferramenta? Nos avise!</p>
              
              <textarea 
                value={suggestionText} 
                onChange={(e) => setSuggestionText(e.target.value)} 
                placeholder="Descreva sua ideia, sugestão ou relato de erro..." 
                rows={5} 
                style={{ width: '100%', padding: '1rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : 'var(--umber)'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: 'var(--t-surface-glass)', color: 'var(--t-text)', resize: 'vertical', marginBottom: '1.5rem' }} 
              />
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={handleSendWhatsApp} style={{ flex: 1, padding: '0.8rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)' }}>
                  WhatsApp
                </button>
                <button onClick={handleSendEmail} style={{ flex: 1, padding: '0.8rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  E-mail
                </button>
                {/* BOTÃO DE CONFIGURAÇÕES (ENGRENAGEM) */}
              <button onClick={() => setShowSettingsModal(true)} style={{ padding: '0.5rem', background: 'transparent', border: `2px solid var(--t-accent)`, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }} title="Configurações">
                <Settings size={20} color={'var(--t-accent)'} />
              </button>
              </div>
            </div>
          </div>
        )}

        {/* ESPAÇO GLOBAL PARA ANÚNCIO DO GOOGLE (COMPACTO) */}
        <div style={{ padding: '8px', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(107, 68, 35, 0.05)', borderRadius: '8px', marginTop: '2rem', border: `1px dashed var(--t-accent)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Publicidade</span>
          
          <div style={{ width: '100%', maxWidth: '728px' }}>
            <AdBanner slotId="9558175523" />
          </div>
        </div>

{/* MODAL DE AÇÃO DAS PRÁTICAS (REALIZAR OU JÁ REALIZADO) */}
        {activeActionMenu && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setActiveActionMenu(null)}>
            <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '2rem', borderRadius: '16px', maxWidth: '350px', width: '100%', border: `2px solid var(--t-accent-bright)`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setActiveActionMenu(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}><X size={24} /></button>
              
              <h3 style={{ margin: '0 0 1.5rem 0', fontFamily: "'Cinzel', serif", color: 'var(--t-accent-bright)', fontSize: '1.3rem' }}>{activeActionMenu.label}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button onClick={() => handleRealizarPratica(activeActionMenu.key)} style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, var(--gold-bright) 0%, #FFA500 100%)', color: 'var(--black)', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(255,215,0,0.2)' }}>
                  <Zap size={20} /> Realizar no App
                </button>
                
                <button onClick={() => { handleFvDailyPracticeChange(activeActionMenu.key, true); setActiveActionMenu(null); }} style={{ width: '100%', padding: '1rem', background: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9', color: 'var(--t-success-text)', border: `2px solid ${isDark ? 'var(--success)' : 'var(--success)'}`, borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} /> Já Realizado
                </button>

                {/* Se já estiver marcado, dá a opção de desmarcar */}
                {fvDaily.praticas?.[activeActionMenu.key] && (
                  <button onClick={() => { handleFvDailyPracticeChange(activeActionMenu.key, false); setActiveActionMenu(null); }} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: 'var(--t-text-muted)', border: 'none', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}>
                    Desmarcar prática
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL IMERSIVO UNIVERSAL: PRÁTICAS GUIADAS */}
        {isPracticeActive && (
          <Suspense fallback={<ViewFallback />}><PracticeOverlay {...{ activePracticeId, audioRef, confirmImmersivePractice, confirmTemploPractice, enterFullScreen, exitFullScreen, isDark, practicePhase, setCancelClickCount, setIsPracticeActive, setPracticePhase, setTemploSelections, setTratakMouseActive, showToast, temploSelections, tempoDecorrido, tratakMouseActive }} /></Suspense>
        )}

        {/* --- 4. PRÁTICA: RECITAÇÕES EM TELA CHEIA --- */}
        {isPracticeActive && (activePracticeId === 'recitarHonra' || activePracticeId === 'recitar7Fases' || activePracticeId === 'formasGeometricas') && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? '#0a0a14' : 'var(--bg-light)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '2rem', maxWidth: '600px', width: '100%' }}>
              {activePracticeId === 'formasGeometricas'
                ? <Landmark size={64} color={'var(--t-accent)'} style={{ margin: '0 auto 1.5rem', opacity: 0.8 }} />
                : <BookOpen size={64} color={'var(--t-accent)'} style={{ margin: '0 auto 1.5rem', opacity: 0.8 }} />
              }

              <h2 style={{ fontFamily: "'Cinzel', serif", color: 'var(--t-accent)', fontSize: '2.5rem', margin: '0 0 1.5rem 0' }}>
                {activePracticeId === 'recitarHonra' ? 'Código de Dignidade' : (activePracticeId === 'recitar7Fases' ? '7 Fases da ED' : 'Formas Geométricas')}
              </h2>

              <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(139, 115, 85, 0.05)', padding: '2rem', borderRadius: '12px', border: `1px solid var(--t-divider)`, marginBottom: '3rem' }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--t-text)', lineHeight: '1.8', margin: 0, fontStyle: 'italic' }}>
                  {activePracticeId === 'formasGeometricas' ? (
                    <>
                      Visualize e trace mentalmente as formas geométricas básicas (círculo, quadrado, triângulo) com atenção plena, sustentando cada forma na mente antes de passar à seguinte.
                      <br/><br/>
                      A tela permanecerá ativa para que o celular não bloqueie durante sua prática.
                    </>
                  ) : (
                    <>
                      Esta é uma prática de foro íntimo e sagrado. Faça sua recitação com atenção plena e propósito.
                      <br/><br/>
                      A tela permanecerá ativa para que o celular não bloqueie durante sua prática.
                    </>
                  )}
                </p>
              </div>

              <button
                onClick={() => {
                  confirmImmersivePractice(activePracticeId);
                }}
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.3rem', background: 'linear-gradient(135deg, var(--gold-bright) 0%, #FFA500 100%)', color: 'var(--black)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)', transition: 'transform 0.2s', marginBottom: '1.5rem' }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <CheckCircle size={24} style={{ verticalAlign: 'middle', marginRight: '0.5rem', marginBottom: '2px' }} />
                {activePracticeId === 'formasGeometricas' ? 'Prática Concluída' : 'Recitação Concluída'}
              </button>
              
              <button 
                onClick={() => { setIsPracticeActive(false); exitFullScreen(); }} 
                style={{ display: 'block', width: '100%', padding: '1rem', background: 'transparent', color: 'var(--t-text-muted)', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '1.1rem', textDecoration: 'underline' }}
              >
                Cancelar e Voltar
              </button>
            </div>
          </div>
        )}

        {/* MODAL: CARTA DE DEGRAU (SÍNTESE GERADA) */}
        {showCartaDegrauModal && cartaDegrauResult && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}>
            <div className="animate-fadeIn print-area" style={{ background: 'white', color: '#111', maxWidth: '800px', width: '100%', borderRadius: '8px', padding: '3rem', fontFamily: 'Georgia, serif', position: 'relative', marginBottom: '2rem' }}>
              <button onClick={() => setShowCartaDegrauModal(false)} className="no-print" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
                <X size={24} />
              </button>

              <h1 style={{ textAlign: 'center', fontSize: '1.3rem', textDecoration: 'underline', marginBottom: '0.5rem' }}>CARTA DE DEGRAU TERRA</h1>
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--gray-text)', fontStyle: 'italic', marginBottom: '2rem' }}>
                Rascunho gerado por IA — revise e ajuste antes de entregar.
              </p>

              <p><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
              {cartaDegrauResult.masterName && <p><strong>Instrutor:</strong> {cartaDegrauResult.masterName}</p>}
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
                Síntese do período de {new Date(cartaDegrauResult.periodStart + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(cartaDegrauResult.periodEnd + 'T12:00:00').toLocaleDateString('pt-BR')}.
              </p>

              {cartaDegrauResult.itens.map(item => (
                <div key={item.id} style={{ marginTop: '1.5rem' }}>
                  <p style={{ fontWeight: 'bold', margin: 0 }}>{item.label}</p>
                  <p style={{ fontWeight: 'bold', margin: '0.5rem 0 0.2rem 0' }}>Comentários:</p>
                  <p style={{ margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>{item.comentario}</p>
                </div>
              ))}

              <div style={{ marginTop: '3rem' }}>
                <p>Brasília, {new Date().toLocaleDateString('pt-BR')}</p>
                <p style={{ marginTop: '3rem', marginBottom: '0.2rem' }}>_______________________________</p>
                <p style={{ margin: 0 }}>Assinatura</p>
              </div>

              <button onClick={() => window.print()} className="no-print" style={{ marginTop: '2.5rem', width: '100%', padding: '1rem', background: 'var(--umber)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'Georgia, serif' }}>
                <Download size={18} /> Imprimir / Salvar como PDF
              </button>
            </div>
          </div>
        )}

        {/* MODAL: CRIAR GRUPO DE ESTUDO (GDVE) */}
        {showCreateGroupModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setShowCreateGroupModal(false)}>
            <div style={{ background: 'var(--t-page-bg)', padding: '1.5rem', borderRadius: '16px', maxWidth: '380px', width: '100%', border: `2px solid ${isDark ? 'var(--success)' : 'var(--success-strong)'}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCreateGroupModal(false)} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}><X size={20} /></button>
              <h2 style={{ margin: '0 0 1rem', fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={22} /> Criar Grupo de Estudo</h2>
              <input
                type="text"
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nome do grupo (opcional — deixe em branco para um nome egípcio)"
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--t-field-bg)', color: 'var(--t-text)', marginBottom: '0.4rem' }}
              />
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--t-text-soft)' }}>
                Não precisa pensar em um nome: se deixar em branco, o grupo recebe o nome de uma divindade egípcia.
              </p>
              <button
                disabled={isCreatingGroup}
                onClick={createGroup}
                style={{ width: '100%', padding: '0.8rem', background: isDark ? 'var(--success)' : 'var(--success-strong)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isCreatingGroup ? 'default' : 'pointer', opacity: isCreatingGroup ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isCreatingGroup ? <Sparkles className="animate-spin" size={18} /> : <Plus size={18} />}
                {isCreatingGroup ? 'Criando...' : 'Criar Grupo'}
              </button>
            </div>
          </div>
        )}

        {/* MODAL: ESCANEAR CÓDIGO DE BARRAS DO LIVRO */}
        {showBarcodeScanner && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10003, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <button onClick={() => setShowBarcodeScanner(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={28} /></button>
            <h3 style={{ color: 'white', fontFamily: "'Cinzel', serif", marginBottom: '1rem', textAlign: 'center' }}>Aponte a câmera para o código de barras</h3>
            {barcodeScanError ? (
              <p style={{ color: '#ff6b6b', textAlign: 'center', maxWidth: '360px' }}>{barcodeScanError}</p>
            ) : (
              <video ref={barcodeVideoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: '480px', borderRadius: '12px', border: '2px solid var(--gold-bright)', background: 'var(--black)' }} />
            )}
            <p style={{ color: 'var(--border-light)', fontSize: '0.8rem', marginTop: '1rem', textAlign: 'center' }}>Geralmente fica na contracapa, perto do ISBN.</p>
          </div>
        )}

        {/* MODAL: PAINEL DE ADMINISTRAÇÃO DE ACESSOS */}
        {showAdminPanel && (
          <Suspense fallback={<ViewFallback />}><AdminPanel {...{ addAdminEmail, addUnit, adminRecordsList, decidePendingRequest, isDark, isLoadingAdminPanel, isSuperAdmin, myAdminUnits, newAdminEmail, newAdminUnits, newUnitName, pendingRequests, removeAdminEmail, removeUnit, setNewAdminEmail, setNewAdminUnits, setNewUnitName, setShowAdminPanel, unitsList }} /></Suspense>
        )}

        {/* MODAL DE CONFIGURAÇÕES (LEMBRETES) */}
        {showSettingsModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: `2px solid var(--t-accent)`, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
              
              {/* Botão de Fechar */}
              <button onClick={() => setShowSettingsModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
              
              <Settings size={48} color={'var(--t-accent)'} style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 1.5rem 0', fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.6rem' }}>Configurações</h2>
              
              {/* Lembretes: o que de fato acontece */}
              <div style={{ textAlign: 'left', marginBottom: '1.5rem', lineHeight: '1.6', color: 'var(--t-text)' }}>
                <p style={{ margin: '0 0 0.75rem' }}>
                  ☀️ <strong>08:00</strong> · lembrete do Prólogo, se você ainda não o fez.
                </p>
                <p style={{ margin: '0 0 1rem' }}>
                  🌙 <strong>20:00</strong> · lembrete da virtude do dia e do Epílogo, se o dia ainda estiver aberto.
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--t-text-muted)' }}>
                  Notificações neste aparelho: <strong style={{ color: notificationsActive ? 'var(--success)' : 'var(--danger)' }}>{notificationsActive ? 'ativadas' : 'desativadas'}</strong>
                </p>
              </div>

              <button onClick={toggleNotifications} style={{ width: '100%', padding: '1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Bell size={20} /> {notificationsActive ? 'Silenciar lembretes' : 'Ativar lembretes'}
              </button>
              <button onClick={() => { setShowSettingsModal(false); setView('notifications'); }} style={{ width: '100%', padding: '0.9rem', background: 'transparent', color: 'var(--t-accent)', border: `1px solid var(--t-accent)`, borderRadius: '12px', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Smartphone size={18} /> Lembretes por WhatsApp
              </button>
              
            </div>
          </div>
        )}

      </main>
        
      <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--t-text-muted)', borderTop: `1px solid var(--t-divider)`, marginTop: '2rem' }}>
        <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>"Que ninguém durma sem antes examinar as ações do dia"</p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Versos de Ouro de Pitágoras</p>
      </footer>
      
      {/* ============================================================== */}
      {/* MODAL DE PRÁTICAS (Abre ao clicar no Badge "Às vezes/Frequente") */}
      {showPracticesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setShowPracticesModal(false)}>
          <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '1.5rem', borderRadius: '16px', maxWidth: '380px', width: '100%', border: `2px solid ${pb.color}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPracticesModal(false)} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}><X size={20} /></button>
            
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <PraticaIcon size={46} color={pb.color} style={{ margin: '0 auto 0.5rem' }} />
              <h2 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.5rem' }}>Constância de Práticas</h2>
            </div>

            <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--white)', padding: '1.2rem', borderRadius: '12px', border: `1px solid ${pb.color}`, textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', color: pb.color, display: 'block', marginBottom: '0.2rem' }}>Grau Atual</span>
              <h3 style={{ margin: '0 0 0.25rem', fontFamily: "'Cinzel', serif", fontSize: '1.4rem', color: 'var(--t-text)' }}>{pb.label}</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--t-text-muted)', fontStyle: 'italic' }}>Realizadas em {statsMenu.diasPraticas} dias neste ciclo.</p>
              
              {(() => {
                 const dias = statsMenu.diasPraticas;
                 let next = null;
                 if (dias < 1) next = { min: 1, title: 'Raramente' };
                 else if (dias < 12) next = { min: 12, title: 'Às vezes' };
                 else if (dias < 20) next = { min: 20, title: 'Frequente' };
                 else if (dias < 28) next = { min: 28, title: 'Sempre' };
                 
                 if (next) {
                   return (
                     <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid var(--t-line-subtle)` }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--t-text-muted)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                         <span>Rumo a: {next.title}</span>
                         <span>Faltam {next.min - dias} dias</span>
                       </div>
                       <div style={{ width: '100%', height: '8px', background: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                         <div style={{ width: `${Math.min(100, (dias / next.min) * 100)}%`, height: '100%', background: pb.color, transition: 'width 0.5s ease' }}></div>
                       </div>
                     </div>
                   );
                 } else {
                   return (
                     <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px solid var(--t-line-subtle)` }}>
                       <p style={{ margin: 0, fontSize: '0.85rem', color: pb.color, fontWeight: 'bold' }}>🌟 Você manteve práticas impecáveis neste ciclo!</p>
                     </div>
                   );
                 }
              })()}
            </div>

            <button onClick={() => { setShowPracticesModal(false); setShowQuickFv(true); }} style={{ width: '100%', padding: '1rem', background: pb.color, color: 'var(--white)', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: `0 4px 15px ${pb.color}40`, transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
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
            <div className="animate-fadeIn" style={{ background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(253, 251, 247, 0.98)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', border: `2px solid var(--t-accent-bright)`, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', width: 'max-content', maxWidth: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: `1px solid ${isDark ? 'rgba(255,215,0,0.2)' : 'rgba(153,101,21,0.2)'}`, paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--t-accent-bright)', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.1rem' }}><Star size={18} /> Missões e Práticas</h4>
                <button onClick={() => setShowQuickFv(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#aaa' : '#777', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.2rem' }}>
                
                {/* BLOCO ESPECIAL: LEITURA DE BASTIÃO DO CICLO */}
                {fvGdveBastiaoName && (
                  <div style={{ padding: '0.8rem', background: isDark ? 'rgba(0,0,0,0.4)' : 'var(--white)', borderRadius: '8px', border: `1px solid ${fvGdveCycleStatus['bastiao'] ? 'var(--success)' : (isDark ? 'var(--gold)' : 'var(--umber-bright)')}`, marginBottom: '0.5rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    <span style={{ display: 'block', color: 'var(--t-text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.3rem' }}>Leitura do Ciclo</span>
                    <span style={{ display: 'block', color: 'var(--t-text)', fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.8rem', lineHeight: '1.3' }}>{fvGdveBastiaoName}</span>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={async () => {
                         const willBeRead = !fvGdveCycleStatus['bastiao'];
                         const newStatus = { ...fvGdveCycleStatus, bastiao: willBeRead };
                         setFvGdveCycleStatus(newStatus);
                         if (user) {
                           try {
                             await setDoc(doc(db, 'fvData', user.uid), { gdveCycleStatus: newStatus }, { merge: true });
                             if (willBeRead) notifyGroupActivity(`concluiu a leitura: "${fvGdveBastiaoName}"`);
                           } catch (err) {
                             console.error('Erro ao salvar status de leitura do Bastião:', err);
                             setFvGdveCycleStatus(fvGdveCycleStatus);
                             showToast('⚠️ Não foi possível salvar. Verifique sua conexão e tente novamente.');
                           }
                         }
                      }} style={{ flex: 1, padding: '0.5rem', background: fvGdveCycleStatus['bastiao'] ? 'var(--success)' : 'transparent', color: fvGdveCycleStatus['bastiao'] ? 'white' : 'var(--t-text)', border: `1px solid ${fvGdveCycleStatus['bastiao'] ? 'var(--success)' : 'var(--t-field-border)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'all 0.2s' }}>
                         {fvGdveCycleStatus['bastiao'] ? <CheckCircle size={14}/> : <div style={{width:'14px', height:'14px', borderRadius:'50%', border:'1px solid currentColor'}}></div>}
                         {fvGdveCycleStatus['bastiao'] ? 'Já Li' : 'Marcar Lido'}
                      </button>
                      
                      {fvGdveBastiaoLink && (
                         <a href={fvGdveBastiaoLink} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '0.5rem', background: isDark ? 'rgba(74, 144, 226, 0.2)' : '#e3f2fd', color: 'var(--t-blue-text)', border: `1px solid var(--t-blue-text)`, borderRadius: '6px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'all 0.2s' }}>
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
                      <div key={task.id} onClick={() => toggleGdveTask(task)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: isCompleted ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : 'var(--t-field-bg)', borderRadius: '8px', border: `1px solid ${isCompleted ? 'var(--success)' : 'var(--t-field-border)'}`, cursor: 'pointer', transition: 'all 0.2s', gap: '1rem', marginBottom: '0.2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: isCompleted ? 'var(--t-success-text)' : 'var(--t-text)', fontSize: '0.9rem', fontWeight: isCompleted ? 'bold' : 'normal', textDecoration: isCompleted ? 'line-through' : 'none' }}>{task.name}</span>
                          {isCycle && <span style={{ fontSize: '0.65rem', color: 'var(--t-text-faint)', textTransform: 'uppercase', marginTop: '0.2rem', fontWeight: 'bold' }}>Missão do Ciclo</span>}
                        </div>
                        <div style={{ background: isCompleted ? 'var(--success)' : (isDark ? '#333' : 'var(--border-soft)'), color: isCompleted ? 'var(--white)' : 'var(--t-text-soft)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {displayValue}
                        </div>
                      </div>
                    );
                  })
                )}

                {fvConfig?.praticas && (
                  <div style={{ height: '1px', background: 'var(--t-line-subtle)', margin: '0.5rem 0' }}></div>
                )}

                {/* 2. PRÁTICAS FIXAS DA ESCOLA */}
                {fvConfig?.praticas?.map(prac => {
                  const isCompleted = !!fvDaily.praticas?.[prac.key];
                  return (
                    <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: isCompleted ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : 'var(--t-field-bg)', borderRadius: '8px', border: `1px solid ${isCompleted ? 'var(--success)' : (isDark ? 'rgba(212,175,55,0.3)' : 'var(--border-light)')}`, cursor: 'pointer', transition: 'all 0.2s', gap: '1rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: isCompleted ? 'var(--t-success-text)' : 'var(--t-text)', fontSize: '0.9rem', fontWeight: isCompleted ? 'bold' : 'normal', textDecoration: isCompleted ? 'line-through' : 'none' }}>{prac.label}</span>
                      {isCompleted ? <CheckCircle size={16} color="var(--success)" /> : <Zap size={16} color={isDark ? 'var(--gold-muted)' : 'var(--border-light)'} />}
                    </div>
                  );
                })}
                
                {(!fvGdveBastiaoName && fvGdveTasks.length === 0 && (!fvConfig?.praticas || fvConfig.praticas.length === 0)) && (
                   <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--t-text-faint)', fontStyle: 'italic', textAlign: 'center' }}>Nenhuma prática ou missão pendente.</p>
                )}
              </div>
            </div>
          )}

          {/* Botão Flutuante (A Estrela) */}
          <button onClick={() => setShowQuickFv(!showQuickFv)} style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold-bright) 0%, #FFA500 100%)', color: 'var(--black)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <Star size={28} fill="var(--black)" />
          </button>
        </div>
      )}

      {/* BANNER DE INSTALAÇÃO DO PWA (ALTO CONTRASTE) */}
      {showInstallBanner && (
        <div className="animate-fadeIn" style={{ 
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 
          background: isDark ? 'linear-gradient(135deg, var(--gold-bright) 0%, #FF8C00 100%)' : 'linear-gradient(135deg, #1e272e 0%, #2c3e50 100%)', 
          padding: '1rem 1.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '1rem', 
          boxShadow: isDark ? '0 10px 30px rgba(255, 140, 0, 0.4)' : '0 15px 35px rgba(0,0,0,0.5)', 
          zIndex: 10000, width: 'max-content', maxWidth: '95%' 
        }}>
          <Download size={28} color={isDark ? 'var(--black)' : 'var(--gold-bright)'} style={{ flexShrink: 0 }} />
          <div style={{ color: isDark ? 'var(--black)' : 'white', fontFamily: 'Georgia, serif', textAlign: 'left' }}>
            <strong style={{ display: 'block', fontSize: '1.1rem', lineHeight: '1.2', textTransform: 'uppercase', letterSpacing: '1px' }}>Instalar o Diário</strong>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>Tenha o aplicativo na sua tela inicial!</span>
          </div>
          <button onClick={handleInstallClick} style={{ padding: '0.6rem 1.2rem', background: isDark ? 'var(--black)' : 'var(--gold-bright)', color: isDark ? 'var(--gold-bright)' : 'var(--black)', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '0.5rem', flexShrink: 0, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>Instalar</button>
          <button onClick={() => setShowInstallBanner(false)} style={{ background: 'transparent', border: 'none', color: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>
      )}

      {/* CELEBRAÇÃO (confete leve ao fechar o ciclo do dia) */}
      {celebration && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20002, overflow: 'hidden' }}>
          {celebration.particles.map(p => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.distance;
            const ty = Math.sin(rad) * p.distance;
            return (
              <div
                key={p.id}
                className="confetti-piece"
                style={{
                  position: 'fixed', top: '50%', left: '50%', width: `${p.size}px`, height: `${p.size}px`,
                  background: p.color, borderRadius: '2px', animationDelay: `${p.delay}s`,
                  '--tx': `${tx}px`, '--ty': `${ty}px`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* PILHA DE TOASTS (substitui alert()) */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 20001, display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center', width: 'min(92vw, 420px)', pointerEvents: 'none' }}>
          {toasts.map(t => {
            const palette = t.type === 'success'
              ? { bg: 'var(--success)', icon: <CheckCircle size={18} /> }
              : t.type === 'error'
                ? { bg: 'var(--danger)', icon: <AlertCircle size={18} /> }
                : { bg: isDark ? 'var(--bg-dark)' : 'var(--ink)', icon: <Sparkles size={18} /> };
            return (
              <div key={t.id} className="toast-in" style={{ background: palette.bg, color: 'white', padding: '0.85rem 1.2rem', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'Georgia, serif', fontSize: '0.9rem', width: '100%', pointerEvents: 'auto' }}>
                {palette.icon}
                <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
                <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', flexShrink: 0, display: 'flex' }}><X size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO (substitui window.confirm) */}
      {confirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => { const fn = confirmModal.onCancel; setConfirmModal(null); fn?.(); }}>
          <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '1.75rem', borderRadius: '16px', maxWidth: '380px', width: '100%', border: `2px solid ${confirmModal.danger ? 'var(--danger)' : 'var(--t-accent)'}`, boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--t-text)', fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { const fn = confirmModal.onCancel; setConfirmModal(null); fn?.(); }} style={{ flex: 1, padding: '0.75rem', background: 'transparent', color: 'var(--t-text-muted)', border: `1px solid ${isDark ? '#555' : 'var(--border-light)'}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>{confirmModal.cancelLabel}</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn?.(); }} style={{ flex: 1, padding: '0.75rem', background: confirmModal.danger ? 'var(--danger)' : 'var(--t-accent)', color: confirmModal.danger ? 'white' : 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>{confirmModal.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENTRADA DE TEXTO (substitui window.prompt) */}
      {promptModalState && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={() => setPromptModalState(null)}>
          <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '1.75rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: `2px solid var(--t-accent)`, boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 1rem', color: 'var(--t-text)', fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{promptModalState.message}</p>
            <input
              type={promptModalState.inputType}
              autoFocus
              value={promptInputValue}
              onChange={(e) => setPromptInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { const fn = promptModalState.onSubmit; const v = promptInputValue; setPromptModalState(null); fn?.(v); } }}
              placeholder={promptModalState.placeholder}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? '#555' : 'var(--border-light)'}`, background: 'var(--t-field-bg)', color: 'var(--t-text)', marginBottom: '1.25rem', fontFamily: 'Georgia, serif', fontSize: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setPromptModalState(null)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', color: 'var(--t-text-muted)', border: `1px solid ${isDark ? '#555' : 'var(--border-light)'}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>Cancelar</button>
              <button onClick={() => { const fn = promptModalState.onSubmit; const v = promptInputValue; setPromptModalState(null); fn?.(v); }} style={{ flex: 1, padding: '0.75rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>{promptModalState.submitLabel}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;