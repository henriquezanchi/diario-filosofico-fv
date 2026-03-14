import React, { useState, useEffect, useRef } from 'react'; // 👈 ADICIONE O useRef AQUI
// Adicione o ícone Bell na lista do lucide-react:
import { 
  BookOpen, Sunrise, Sunset, Search, Calendar, Moon, Sun, 
  Sparkles, ChevronRight, LogOut, Shuffle, Plus, X, 
  AlertCircle, Eye, EyeOff, CheckCircle, Download, Upload,
  Target, TrendingUp, Award, FileText, Book, Settings,
  Trash2, Edit, Save, XCircle, Flame, Zap, Shield, Star, Crown, 
  Bell, Check, Music, MessageSquare, Menu, Lock,
  Sun, Moon, MessageSquare, LogOut, Settings, Save, X
} from 'lucide-react';
// Na importação do Firebase, puxe o messaging e o getToken:
import { auth, db, messaging } from './config/firebase-config'; // 👈 Adicione o messaging aqui
import { getToken, deleteToken, onMessage } from 'firebase/messaging'; // 👈 ADICIONE O deleteToken
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
  getDocs, updateDoc, deleteDoc, Timestamp, deleteField // 👈 ADICIONE AQUI 
} from 'firebase/firestore';
import './App.css';
import AdBanner from './AdBanner'; // 👈 ADICIONE ESTA LINHA AQUI

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
  
  // Horários Personalizados de Notificação
  const [morningTime, setMorningTime] = useState('08:00');
  const [eveningTime, setEveningTime] = useState('20:00');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Função Inteligente: Liga e Desliga Notificações (UX Melhorada)
  const toggleNotifications = async () => {
    // SE JÁ ESTIVER ATIVADO: Vamos desativar (Sem mandar o usuário para o navegador)
    if (notificationsActive) {
      const confirmDisable = window.confirm('Deseja silenciar os lembretes do Diário Filosófico?');
      if (confirmDisable) {
        try {
          // Deleta o token da memória e do banco de dados. O servidor não consegue mais enviar.
          await deleteToken(messaging);
          if (user) {
            await updateDoc(doc(db, 'users', user.uid), { fcmToken: deleteField() });
          }
          setNotificationsActive(false);
          // Aviso amigável e direto. A mágica acontece nos bastidores.
          alert('🔕 Lembretes silenciados. Você não receberá mais os avisos de Prólogo e Epílogo.');
        } catch (error) {
          console.error('Erro ao silenciar:', error);
          alert('Houve um pequeno erro. Tente novamente.');
        }
      }
      return;
    }

    // SE ESTIVER DESATIVADO: Vamos ativar
    try {
      // Pede permissão ao navegador (Se ele já deu permissão antes, o navegador pula essa etapa invisivelmente)
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
        // Aqui é o ÚNICO cenário onde o usuário precisa ir no navegador: se ele mesmo bloqueou!
        alert('As notificações estão bloqueadas no seu navegador. Para receber lembretes, clique no ícone de "Cadeado" ao lado do endereço do site e mude para "Permitir".');
      }
    } catch (error) {
      console.error('Erro ao ativar notificações:', error);
      alert('Seu dispositivo parece não suportar esse tipo de aviso no momento.');
    }
  };

  // Estados de Navegação e Fogo Interno
  const [view, setView] = useState('today');
  const [theme, setTheme] = useState('light');
  const [searchTerm, setSearchTerm] = useState('');
  const [streak, setStreak] = useState(0); 
  const [longestStreak, setLongestStreak] = useState(0); 
  const [showStreakModal, setShowStreakModal] = useState(false); 

  // NOVO: Controles do Menu Mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 850);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    // ATENÇÃO: Troque "seuemail@gmail.com" pelo seu e-mail real
    window.open(`mailto:henrique.zanchi@gmail.com?subject=${subject}&body=${body}`); 
    setShowSuggestionModal(false);
    setSuggestionText('');
  };

  const handleSendWhatsApp = () => {
    if (!suggestionText.trim()) return alert('Por favor, digite sua sugestão primeiro!');
    const text = encodeURIComponent(`*Ideia/Melhoria - Diário Filosófico* 💡\n\n${suggestionText}`);
    // ATENÇÃO: Troque "5511999999999" pelo seu número de WhatsApp real (Código do País + DDD + Número)
    window.open(`https://wa.me/5562991729783?text=${text}`, '_blank');
    setShowSuggestionModal(false);
    setSuggestionText('');
  };

  // Estados do Prólogo e Epílogo
  const [morningDone, setMorningDone] = useState(false);
  const [selectedVirtue, setSelectedVirtue] = useState('');
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

  // Estados FV (Força Viva)
  const [fvUnlocked, setFvUnlocked] = useState(false);
  const [fvClickCount, setFvClickCount] = useState(0);
  const [fvLockClickCount, setFvLockClickCount] = useState(0);
  const [fvLastCartaDate, setFvLastCartaDate] = useState('');
  const [fvNextCartaDate, setFvNextCartaDate] = useState('');
  const [fvGdveDesafios, setFvGdveDesafios] = useState([]);
  const [fvGdveReuniao, setFvGdveReuniao] = useState('');
  
  // NOVO: Estado Diário da Carta de Degrau FV
  const [fvDaily, setFvDaily] = useState({
    item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
    horasGuarda: '', horasAula: '',
    praticas: {
      tratak: false, recitarHonra: false, recitar7Fases: false,
      camara: false, templo: false, porta: false, patioAberto: false,
      patioColunas: false, santuario: false
    }
  });

  // NOVO: Controle Universal das Práticas Guiadas
  const [isPracticeActive, setIsPracticeActive] = useState(false); 
  const [activePracticeId, setActivePracticeId] = useState(null); 
  const [practicePhase, setPracticePhase] = useState('intro'); 
  const [cancelClickCount, setCancelClickCount] = useState(0); 
  const [tratakMouseActive, setTratakMouseActive] = useState(false);
  
  // ESTADO DO TEMPLO: Guarda as etapas que ele passou durante a música
  const [temploSelections, setTemploSelections] = useState({ porta: false, patioAberto: false, patioColunas: false, santuario: false });

  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const audioRef = useRef(null); 

  // Função que decide o que abrir quando clica em "Realizar"
  const handleRealizarPratica = (key) => {
    setActiveActionMenu(null); 
    
    if (key === 'tratack' || key === 'camara') {
      setActivePracticeId(key); 
      setPracticePhase('intro'); 
      setIsPracticeActive(true); 
    } 
    // Se clicar em QUALQUER etapa do Templo, abre a Imersão do Templo!
    else if (['porta', 'patioAberto', 'patioColunas', 'santuario'].includes(key)) {
      setActivePracticeId('templo');
      // Puxa o que já estava marcado antes de começar
      setTemploSelections({
        porta: fvDaily.praticas?.porta || false,
        patioAberto: fvDaily.praticas?.patioAberto || false,
        patioColunas: fvDaily.praticas?.patioColunas || false,
        santuario: fvDaily.praticas?.santuario || false
      });
      setPracticePhase('intro'); 
      setIsPracticeActive(true); 
    } 
    // Bloqueio das recitações sigilosas
    else {
      alert('Esta é uma prática de foro íntimo e sagrado. Por favor, faça a sua recitação privadamente e marque a opção "Já Realizado".');
    }
  };

  // NOVO: Funções de Tela Cheia (Imersão)
  const enterFullScreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(e => console.log(e)); }
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); } // Safari
  };

  const exitFullScreen = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) { document.exitFullscreen().catch(e => console.log(e)); }
      else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); } // Safari
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

  // NOVO: Sistema de Gamificação Inteligente (Com Ícones)
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
    setFvUnlocked(false);
    setLastDrawDate(null);
    setFvDaily({
      item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
      horasGuarda: '', horasAula: '',
      praticas: { tratak: false, recitarHonra: false, recitar7Fases: false, camara: false, templo: false, porta: false, patioAberto: false, patioColunas: false, santuario: false }
    });
  };

  const getTasksForToday = () => {
    const todayDate = new Date();
    const currentDayOfWeek = todayDate.getDay(); 
    const currentDayOfMonth = todayDate.getDate();
    const todayObj = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

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

  const handleLogoClick = () => {
    setFvClickCount(prev => prev + 1);
    if (fvClickCount >= 6) {
      setFvUnlocked(true);
      setFvClickCount(0);
      if (user) { updateDoc(doc(db, 'users', user.uid), { fvUnlocked: true }); }
      alert('🔓 Modo Força Viva desbloqueado!');
    }
    setTimeout(() => setFvClickCount(0), 3000);
  };

  // Função para apenas navegar para a aba FV (sem contar cliques)
  const handleFvTabClick = () => {
    setView('fv'); 
  };

  // NOVO: Função do botão VISÍVEL que tranca tudo com 1 clique
  const handleInstantFvLock = async () => {
    setFvUnlocked(false); 
    setView('today'); 
    if (user) { 
      try { await updateDoc(doc(db, 'users', user.uid), { fvUnlocked: false }); } 
      catch(e) {} 
    }
    alert('🔒 Modo Força Viva ocultado com segurança!');
  };

  const selectRandomVirtue = async () => {
    if (!canDrawToday()) {
      alert('Você já sorteou sua virtude hoje! Comprometa-se com ela até o fim do dia. 🎯');
      return;
    }
    const randomIndex = Math.floor(Math.random() * virtues.length);
    const selectedV = virtues[randomIndex].name;
    setSelectedVirtue(selectedV);
    setShowCustomVirtue(false);
    const today = getTodayKey();
    setLastDrawDate(today);

    if (user) {
      try { await updateDoc(doc(db, 'users', user.uid), { lastDrawDate: today }); } 
      catch (error) { console.log('Erro ao salvar data do sorteio'); }
    }
  };

  const canDrawToday = () => {
    const today = getTodayKey();
    return lastDrawDate !== today;
  };

  // Motor de Inatividade (Com Escudo Universal de Práticas)
  useEffect(() => {
    // Se isPracticeActive for true, o app NÃO desloga em NENHUMA prática!
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

// O Convite Ativo de Notificações
  useEffect(() => {
    if (user && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Se ainda não escolheu, espera 3 segundos e mostra o convite
        const timer = setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

// Ouve as mensagens quando o app ESTIVER ABERTO (Foreground)
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Mensagem recebida com o app aberto: ', payload);
      
      if (Notification.permission === 'granted') {
        // Verifica se é de manhã ou de noite pelo título da mensagem
        const isMorning = payload.notification.title.includes('Matinal');
        const correctIcon = isMorning 
          ? 'https://img.icons8.com/ios-filled/512/8b7355/open-book.png' 
          : 'https://img.icons8.com/ios-filled/512/8b7355/owl.png';

        // Usa uma "tag" para evitar que o navegador duplique notificações iguais
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: correctIcon,
          tag: 'diario-notification' 
        });
      }
    });

    return () => unsubscribe();
  }, []);

// Motor Universal das Práticas: Cronômetros e Sensores
  useEffect(() => {
    let timer;
    let mouseSafetyTimer;
    
    if (activePracticeId === 'tratack' && practicePhase === 'practice') {
      timer = setTimeout(() => setPracticePhase('done'), 180000); 
      // Libera o cancelamento por mouse após 2 segundos (tempo para soltar o mouse)
      mouseSafetyTimer = setTimeout(() => setTratakMouseActive(true), 2000);
    } else {
      setTratakMouseActive(false); // Reseta a trava se não estiver no tratak
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
            signOut(auth);
            setShowInactivityWarning(false);
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
        setFvUnlocked(data.fvUnlocked || false);

        // NOVO: Puxa os horários salvos ou usa o padrão
        setMorningTime(data.morningTime || '08:00'); 
        setEveningTime(data.eveningTime || '20:00');
        
        // NOVO: O sininho só fica verde se existir um token real salvo no banco de dados!
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

  const loadTodayEntry = async (uid) => {
    try {
      const today = getTodayKey();
      const entryDoc = await getDoc(doc(db, 'entries', `${uid}_${today}`));
      if (entryDoc.exists()) {
        const data = entryDoc.data();
        setMorningDone(data.morningDone || false);
        setSelectedVirtue(data.virtue || '');
        setCustomVirtue(data.customVirtue || '');
        setDailyIntention(data.intention || '');
        setEveningDone(data.eveningDone || false);
        setWhereIFailed(data.whereIFailed || '');
        setWhatIDidWell(data.whatIDidWell || '');
        setWhatILeftUndone(data.whatILeftUndone || '');
        setDidMorning(data.didMorning !== false);
        setDailyQuote(data.quote || null);
        setTodayTasksStatus(data.tasksStatus || {});
        // Carregar os dados diários do FV
        setFvDaily(data.fvDaily || {
          item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
          horasGuarda: '', horasAula: '',
          praticas: { tratak: false, recitarHonra: false, recitar7Fases: false, camara: false, templo: false, porta: false, patioAberto: false, patioColunas: false, santuario: false }
        });
      } else {
         setFvDaily({
          item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
          horasGuarda: '', horasAula: '',
          praticas: { tratak: false, recitarHonra: false, recitar7Fases: false, camara: false, templo: false, porta: false, patioAberto: false, patioColunas: false, santuario: false }
        });
      }

      if (!dailyQuote) {
        const randomQuote = philosophicalQuotes[Math.floor(Math.random() * philosophicalQuotes.length)];
        setDailyQuote(randomQuote);
      }
    } catch (error) {
      console.error('Erro ao carregar entrada:', error);
      const randomQuote = philosophicalQuotes[Math.floor(Math.random() * philosophicalQuotes.length)];
      setDailyQuote(randomQuote);
    }
  };

  const loadAllEntries = async (uid) => {
    try {
      const q = query(collection(db, 'entries'), where('userId', '==', uid));
      const querySnapshot = await getDocs(q);
      const loadedEntries = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.eveningDone || data.fvDaily) { // Carrega se tiver epílogo ou registro FV
          loadedEntries.push({ id: doc.id, ...data });
        }
      });
      loadedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEntries(loadedEntries);

      if (loadedEntries.length > 0) {
        let maxStreak = 1;
        let tempCalc = 1;
        // Calcula a ofensiva apenas para dias que tiveram o Epílogo concluído
        const streakEntries = loadedEntries.filter(e => e.eveningDone);
        
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
        setLongestStreak(maxStreak);

        const todayKey = getTodayKey();
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yesterdayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        let currentStreak = 0;
        let dateToCheck = streakEntries.length > 0 && streakEntries[0].date === todayKey ? todayKey : (streakEntries.length > 0 && streakEntries[0].date === yesterdayKey ? yesterdayKey : null);
        
        if (dateToCheck) {
          for (const entry of streakEntries) {
            if (entry.date === dateToCheck) {
              currentStreak++;
              const prevD = new Date(dateToCheck + 'T12:00:00');
              prevD.setDate(prevD.getDate() - 1);
              dateToCheck = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
            } else {
              break;
            }
          }
        }
        setStreak(currentStreak);
      } else {
        setStreak(0);
        setLongestStreak(0);
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
    try {
      const fvDoc = await getDoc(doc(db, 'fvData', uid));
      if (fvDoc.exists()) {
        const data = fvDoc.data();
        setFvLastCartaDate(data.lastCartaDate || '');
        setFvNextCartaDate(data.nextCartaDate || '');
        setFvGdveDesafios(data.gdveDesafios || []);
        setFvGdveReuniao(data.gdveReuniao || '');
      }
    } catch (error) { console.error('Erro ao carregar dados FV:', error); }
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
      const todayKey = getTodayKey();
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

    const todayKey = getTodayKey();
    const entry = {
      userId: user.uid, date: todayKey, morningDone: true, virtue: finalVirtue,
      customVirtue: showCustomVirtue ? customVirtue : '', quote: dailyQuote || null,
      intention: dailyIntention || '', tasksStatus: todayTasksStatus || {},
      tasksSnapshot: tasksSnapshot || [], morningTimestamp: Timestamp.now()
    };

    try {
      await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), entry, { merge: true });
      setMorningDone(true); alert('✅ Prólogo salvo com sucesso!');
    } catch (error) { alert('Erro ao salvar prólogo. Verifique sua conexão.'); }
  };

  const saveEvening = async () => {
    if (!whereIFailed || !whereIFailed.trim() || !whatIDidWell || !whatIDidWell.trim() || !whatILeftUndone || !whatILeftUndone.trim()) {
      alert('Por favor, responda todas as três perguntas do exame noturno.'); return;
    }

    const todayKey = getTodayKey();
    const tasksSnapshot = getTasksForToday().map(task => ({
      id: task.id, name: task.name, completed: !!todayTasksStatus[task.id]
    }));

    try {
      const entryRef = doc(db, 'entries', `${user.uid}_${todayKey}`);
      const existing = await getDoc(entryRef);
      const existingData = existing.exists() ? existing.data() : {};

      const updatedEntry = {
        ...existingData, userId: user.uid, date: todayKey, eveningDone: true,
        whereIFailed: whereIFailed || '', whatIDidWell: whatIDidWell || '', whatILeftUndone: whatILeftUndone || '',
        didMorning: didMorning !== false, tasksStatus: todayTasksStatus || {},
        tasksSnapshot: tasksSnapshot || [], eveningTimestamp: Timestamp.now()
      };

      await setDoc(entryRef, updatedEntry, { merge: true });
      setEveningDone(true); await loadAllEntries(user.uid);
      alert('✅ Epílogo salvo com sucesso!');
    } catch (error) { alert('Erro ao salvar epílogo. Tente novamente.'); }
  };

  const saveLongTermGoals = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'longTermGoals', user.uid), { yearGoals, lifeGoals, updatedAt: Timestamp.now() });
        setShowGoalsEditor(false); alert('✅ Metas salvas com sucesso!');
      } catch (error) { alert('Erro ao salvar metas.'); }
    }
  };

  // Salvar Dados Estáticos do Planejamento FV (Datas)
  const saveFvPlanning = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'fvData', user.uid), {
          lastCartaDate: fvLastCartaDate || '',
          nextCartaDate: fvNextCartaDate || '',
          gdveDesafios: fvGdveDesafios || [],
          gdveReuniao: fvGdveReuniao || '',
          updatedAt: Timestamp.now()
        }, { merge: true }); 
        alert('✅ Datas do Planejamento da Força Viva salvas!');
      } catch (error) { console.error(error); alert('Erro ao salvar dados.'); }
    }
  };

  // NOVO: Salvar Registro Diário da Carta de Degrau (FV)
  const saveFvDailyRecord = async () => {
    if (user) {
      const todayKey = getTodayKey();
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          userId: user.uid,
          date: todayKey,
          fvDaily: fvDaily,
          fvDailyTimestamp: Timestamp.now()
        }, { merge: true }); 
        alert('✅ Registro Diário FV salvo com sucesso para o dia de hoje!');
        await loadAllEntries(user.uid);
      } catch (error) { console.error(error); alert('Erro ao salvar registro FV.'); }
    }
  };

  const handleFvDailyTextChange = (key, value) => {
    setFvDaily(prev => ({ ...prev, [key]: value }));
  };

  const handleFvDailyPracticeChange = (key, value) => {
    setFvDaily(prev => ({ ...prev, praticas: { ...prev.praticas, [key]: value } }));
  };

  // NOVO: Salva as práticas imersivas automaticamente no banco de dados ao finalizá-las
  const confirmImmersivePractice = async (key) => {
    const newFvDaily = {
      ...fvDaily,
      praticas: { ...fvDaily.praticas, [key]: true }
    };
    setFvDaily(newFvDaily); // Atualiza na tela
    setIsPracticeActive(false);
    exitFullScreen();

    if (user) {
      const todayKey = getTodayKey();
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          fvDaily: newFvDaily
        }, { merge: true });
        await loadAllEntries(user.uid); // Atualiza o histórico na hora!
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
      const todayKey = getTodayKey();
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
    link.download = fvUnlocked ? `relatorio-forca-viva-${getTodayKey()}.csv` : `diario-filosofico-${getTodayKey()}.csv`; 
    link.click();
  };

  // NOVO: Gerador de Dossiê TXT para confecção da Carta de Degrau
  const exportFvReportTXT = () => {
    if (entries.length === 0) { alert('Não há entradas para exportar'); return; }
    
    let txtContent = `====================================================\n`;
    txtContent += `    RELATÓRIO DE PREPARAÇÃO - CARTA DE DEGRAU\n`;
    txtContent += `    Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n`;
    txtContent += `====================================================\n\n`;
    
    // Inverte a ordem para o relatório ficar do dia mais antigo para o dia mais recente (ordem cronológica)
    const reversedEntries = [...entries].reverse();
    let hasData = false;

    reversedEntries.forEach(entry => {
      if (entry.fvDaily) {
        const fv = entry.fvDaily;
        // Checa se o usuário escreveu em pelo menos um dos itens 1 ao 7 neste dia
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
      alert('Você ainda não tem textos preenchidos nos itens da Força Viva para gerar o relatório.');
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
    // Tranca o Modo FV automaticamente no banco de dados antes de sair!
    if (user && fvUnlocked) {
      try { await updateDoc(doc(db, 'users', user.uid), { fvUnlocked: false }); } catch(err) {}
    }
    setFvUnlocked(false); // Tranca na tela
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
    (entry.virtue && entry.virtue.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isDark = theme === 'dark';
  const streakInfo = getStreakInfo(streak); // Pega os dados do seu nível atual
  const StreakIcon = streakInfo.current.icon; // Extrai a imagem do seu "brasão"

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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              
              {/* BADGE DE FOGO (SEMPRE VISÍVEL NO CELULAR) */}
              <div onClick={() => setShowStreakModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.6rem', background: streak > 0 ? (isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0'), border: `1px solid ${streak > 0 ? (isDark ? '#ff9800' : '#ffb74d') : (isDark ? '#555' : '#ccc')}`, borderRadius: '12px', color: streak > 0 ? (isDark ? '#ffb74d' : '#e65100') : (isDark ? '#aaa' : '#777'), fontWeight: 'bold', fontSize: '0.9rem' }}>
                <StreakIcon size={16} fill={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : 'none'} color={streak > 0 ? (isDark ? '#ff9800' : '#e65100') : (isDark ? '#aaa' : '#777')} /> {streak}
              </div>

              <button onClick={toggleNotifications} style={{ position: 'relative', padding: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <Bell size={24} color={notificationsActive ? '#4caf50' : (isDark ? '#d4af37' : '#6b4423')} />
                {notificationsActive && <div style={{ position: 'absolute', top: '0', right: '0', background: '#4caf50', borderRadius: '50%', padding: '2px' }}><Check size={10} color="white" strokeWidth={4} /></div>}
              </button>
              <button onClick={toggleTheme} style={{ padding: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {isDark ? <Sun size={24} color="#d4af37" /> : <Moon size={24} color="#8b7355" />}
              </button>
              <button onClick={() => setIsMobileMenuOpen(true)} style={{ padding: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <Menu size={32} color={isDark ? '#d4af37' : '#6b4423'} />
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
        <div className="animate-fadeIn" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(240, 230, 210, 0.98)', zIndex: 10001, padding: '1rem', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0 2rem 0', borderBottom: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, marginBottom: '2rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.5rem' }}>Menu</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={32} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

            {/* TRATAK NO MENU MOBILE */}
            <button onClick={() => { setIsMobileMenuOpen(false); setActivePracticeId('tratack'); setPracticePhase('intro'); setIsPracticeActive(true); }} style={{ width: '100%', padding: '1.2rem', textAlign: 'left', background: 'transparent', color: isDark ? '#f0e6d2' : '#2c1810', border: '1px solid transparent', borderRadius: '12px', fontSize: '1.3rem', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Target size={24} color={isDark ? '#f0e6d2' : '#2c1810'} /> Tratak
            </button>
            
            {fvUnlocked && (
              <button onClick={() => { setView('fv'); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1.2rem', textAlign: 'left', background: view === 'fv' ? 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%)' : 'transparent', color: view === 'fv' ? '#FFD700' : (isDark ? '#f0e6d2' : '#2c1810'), border: `1px solid ${view === 'fv' ? '#FFD700' : 'transparent'}`, borderRadius: '12px', fontSize: '1.3rem', fontFamily: 'Georgia, serif', fontWeight: view === 'fv' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Award size={24} color="#FFD700" /> Força Viva
              </button>
            )}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '2rem', borderTop: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}` }}>
            <button onClick={() => { setShowSuggestionModal(true); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <MessageSquare size={20} /> Enviar Sugestão
            </button>
            
            {/* ENGRENAGEM NO MENU DE CELULAR */}
            <button onClick={() => { setShowSettingsModal(true); setIsMobileMenuOpen(false); }} style={{ width: '100%', padding: '1rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `2px solid ${isDark ? '#d4af37' : '#6b4423'}`, borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Settings size={20} /> Configurações
            </button>

            <button onClick={handleLogout} style={{ width: '100%', padding: '1rem', background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', borderRadius: '12px', fontSize: '1.1rem', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <LogOut size={20} /> Sair do Diário
            </button>
          </div>
        </div>
      )}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* VIEW: TODAY */}
        {view === 'today' && (
          <div>
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
                      <div style={{ marginTop: '1rem', padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.5)', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#d4af37' : '#6b4423' }}>{selectedVirtue}</h4>
                        <p style={{ margin: '0.5rem 0', fontSize: '0.95rem', color: isDark ? '#c8b896' : '#6b5744' }}>{virtues.find(v => v.name === selectedVirtue)?.shortDesc}</p>
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

        {/* VIEW: FV */}
        {view === 'fv' && fvUnlocked && (
          <div className="animate-fadeIn">
            <div style={{ background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.1) 100%)', padding: '2rem', borderRadius: '16px', border: '2px solid #FFD700', boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)' }}>
              
              {/* TÍTULO E BOTÃO DE BLOQUEIO VISÍVEL */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Award size={32} color="#FFD700" />
                  <div>
                    <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>Registro Diário da Força Viva | CD </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem' }}>Dia: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                
                {/* O BOTÃO QUE TRANCA NA HORA */}
                <button onClick={handleInstantFvLock} style={{ padding: '0.6rem 1.2rem', background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', transition: 'all 0.2s' }}>
                  <Lock size={18} /> Ocultar Modo FV
                </button>
              </div>

              {/* FORMULÁRIO DIÁRIO FV */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
                
                {[
                  { id: 'item1', title: '1 – VARRER POR DENTRO', desc: 'Exame da personalidade, descobrir os nós, buscar as causas que os geraram, encontrar a fórmula de limpeza (redenção) e aplicá-las.' },
                  { id: 'item2', title: '2 – AS LEIS DA MATÉRIA', desc: 'Descobrir como atuam em nós os ciclos da matéria (para não nos afetarem): instintos de conservação/procriação, idade, enfermidade, ânimo, humor, ideias, sentimentos, ambiente.' },
                  { id: 'item34', title: '3 e 4 – TRABALHO ORDENADO E EFICAZ', desc: 'Colocar ordem na vida. Necessária disciplina e perseverança: exercícios de ordem e limpeza.' },
                  { id: 'item5', title: '5 – ECONOMIA DE TEMPO E ENERGIA', desc: 'Requer atenção.' },
                  { id: 'item6', title: '6 – OS VÍCIOS', desc: 'Superar: preguiça, gula e luxúria e outros da mesma natureza (apatia, moleza, debilidade, negligência). Moderar: álcool e fumo. Proibido: drogas.' },
                  { id: 'item7', title: '7 – AS VIRTUDES: PERSEVERANÇA E CONSTÂNCIA', desc: 'Perseverança: repetir sem rotina com sentido de perfeição. Constância: estabilidade e consciência elevada. (Nota: Comentar sobre frequência no diário, carta, exercícios, ED, etc).' }
                ].map(item => (
                  <div key={item.id}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>{item.title}</label>
                    <p style={{ fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '0.75rem', fontStyle: 'italic', lineHeight: '1.4' }}>{item.desc}</p>
                    <textarea 
                      value={fvDaily[item.id] || ''} 
                      onChange={(e) => handleFvDailyTextChange(item.id, e.target.value)} 
                      placeholder={`Reflexões do dia para o item ${item.title.split(' ')[0]}...`} 
                      rows={3} 
                      style={{ width: '100%', padding: '1rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} 
                    />
                  </div>
                ))}

                {/* HORAS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(255,215,0,0.1)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Horas-Guarda (HH:mm)</label>
                    <input type="time" value={fvDaily.horasGuarda || ''} onChange={(e) => handleFvDailyTextChange('horasGuarda', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Horas-Aula (HH:mm)</label>
                    <input type="time" value={fvDaily.horasAula || ''} onChange={(e) => handleFvDailyTextChange('horasAula', e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }} />
                  </div>
                </div>

                {/* PRÁTICAS - BOTÕES INTELIGENTES */}
                <div style={{ background: isDark ? 'rgba(255,215,0,0.05)' : 'rgba(255,215,0,0.1)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}>Práticas do Dia</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Práticas Gerais */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      {[
                        { key: 'tratack', label: 'Tratak' },
                        { key: 'recitarHonra', label: 'Recitar Código de Dignidade' },
                        { key: 'recitar7Fases', label: 'Recitar 7 fases da ED' },
                        { key: 'camara', label: 'Câmara de Purificação' }
                      ].map(prac => (
                        <div key={prac.key} onClick={() => setActiveActionMenu({ key: prac.key, label: prac.label })} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: fvDaily.praticas?.[prac.key] ? (isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9') : (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)'), border: `1px solid ${fvDaily.praticas?.[prac.key] ? '#4caf50' : (isDark ? 'rgba(212, 175, 55, 0.3)' : '#ccc')}`, borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                          {fvDaily.praticas?.[prac.key] ? <CheckCircle size={18} color="#4caf50" /> : <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${isDark ? '#b8a88a' : '#999'}` }}></div>}
                          <span style={{ color: fvDaily.praticas?.[prac.key] ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '0.95rem', fontWeight: fvDaily.praticas?.[prac.key] ? 'bold' : 'normal' }}>{prac.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Grupo: Templo Interior */}
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
                </div>

                {/* BOTÃO SALVAR DIÁRIO FV */}
                <button onClick={saveFvDailyRecord} style={{ padding: '1rem 2rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)' }}>
                  <CheckCircle size={20} /> Salvar Registro de Hoje (FV)
                </button>

              </div>

              {/* LINHA DIVISÓRIA */}
              <div style={{ height: '2px', background: 'rgba(255,215,0,0.3)', margin: '3rem 0 2rem' }}></div>

              {/* PLANEJAMENTO DATAS FV */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <h3 style={{ margin: 0, color: isDark ? '#FFD700' : '#996515', fontSize: '1.4rem', fontFamily: "'Cinzel', serif" }}>Planejamento de Datas</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Última Entrega da CD </label>
                    <input 
                      type="date" 
                      value={fvLastCartaDate || ''} 
                      onChange={(e) => {
                        const novaData = e.target.value;
                        setFvLastCartaDate(novaData);
                        if (novaData) {
                          const [ano, mes, dia] = novaData.split('-');
                          const dataCalculada = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1 + 3, parseInt(dia, 10));
                          const proxAno = dataCalculada.getFullYear();
                          const proxMes = String(dataCalculada.getMonth() + 1).padStart(2, '0');
                          const proxDia = String(dataCalculada.getDate()).padStart(2, '0');
                          setFvNextCartaDate(`${proxAno}-${proxMes}-${proxDia}`);
                        } else { setFvNextCartaDate(''); }
                      }} 
                      style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#FFD700' : '#996515' }}>Próxima Entrega Prevista da CD</label>
                    <input type="date" value={fvNextCartaDate || ''} onChange={(e) => setFvNextCartaDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#FFD700' : '#996515', fontFamily: "'Cinzel', serif" }}>Próxima Reunião GDVE</label>
                  <input type="datetime-local" value={fvGdveReuniao || ''} onChange={(e) => setFvGdveReuniao(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                </div>
                
                <button onClick={saveFvPlanning} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: isDark ? '#FFD700' : '#996515', border: '2px solid #FFD700', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}>
                  <Save size={18} /> Salvar Datas de Planejamento
                </button>
              </div>
            </div>
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
                {/* NOVO: BOTÃO DO RELATÓRIO TXT DA FORÇA VIVA */}
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
                <h3 style={{ margin: '0 0 1rem 0', color: isDark ? '#ffd700' : '#d4af37', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}><Award size={20} /> Planejamento da Força Viva</h3>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredEntries.map((entry) => (
                  <div key={entry.id} style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '1.5rem', borderRadius: '12px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: isDark ? '#d4af37' : '#6b4423', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                          {/* A MÁGICA AQUI: + 'T12:00:00' impede que o fuso horário do Brasil jogue a data para o dia anterior */}
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {entry.virtue && <span style={{ padding: '0.2rem 0.6rem', background: isDark ? 'rgba(212,175,55,0.2)' : '#fdf5e6', borderRadius: '4px', fontSize: '0.85rem', color: isDark ? '#d4af37' : '#6b4423', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : '#e8dcc4'}` }}>Virtude: <strong>{entry.virtue}</strong></span>}
                          {!entry.didMorning && <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,152,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)' }}>⚠️ Sem Prólogo</span>}
                          
                          {/* SELO DE FORÇA VIVA NO HISTÓRICO */}
                          {entry.fvDaily && fvUnlocked && (
                            <span style={{ padding: '0.2rem 0.6rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', borderRadius: '4px', fontSize: '0.85rem', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 4px rgba(255,215,0,0.2)' }}>
                              <Award size={12} /> Registro FV Realizado
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => deleteEntry(entry.date)} style={{ padding: '0.5rem', background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', borderRadius: '8px', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

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
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#c8b896' : '#4caf50', fontSize: '0.95rem', lineHeight: '1.6' }}>
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

                  {/* NOVO: EXIBIR PRÁTICAS DA FORÇA VIVA / GLOBAIS NO HISTÓRICO */}
                    {entry.fvDaily && entry.fvDaily.praticas && (fvUnlocked || entry.fvDaily.praticas.tratack) && (
                      <div style={{ padding: '1rem', background: isDark ? 'rgba(255, 215, 0, 0.05)' : '#fffbf0', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#FFD700' : '#996515'}`, marginBottom: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#FFD700' : '#996515', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Award size={16} /> {fvUnlocked ? 'Práticas FV Realizadas:' : 'Práticas Extras Realizadas:'}
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#c8b896' : '#6b5744', fontSize: '0.95rem', lineHeight: '1.6' }}>
                          {(() => {
                            const praticasFeitas = Object.entries(entry.fvDaily.praticas)
                              .filter(([_, feito]) => feito)
                              .map(([key]) => key);

                            // Se o usuário não for FV, filtramos para mostrar APENAS o Tratak (protege a confidencialidade das outras)
                            const listaPermitida = fvUnlocked ? praticasFeitas : praticasFeitas.filter(k => k === 'tratack');

                            if (listaPermitida.length === 0) {
                              return fvUnlocked ? <li style={{ fontStyle: 'italic', opacity: 0.7, listStyle: 'none', marginLeft: '-1.2rem' }}>Apenas os registros escritos foram salvos.</li> : null;
                            }

                            const dicionarioGeral = {
                              tratack: 'Tratak',
                              recitarHonra: 'Recitar Código de Dignidade',
                              recitar7Fases: 'Recitar 7 Fases da ED',
                              camara: 'Câmara de Purificação'
                            };
                            const dicionarioTemplo = { porta: 'Porta', patioAberto: 'Pátio Aberto', patioColunas: 'Pátio de Colunas', santuario: 'Santuário' };

                            const listaGeral = listaPermitida.filter(key => dicionarioGeral[key]);
                            const listaTemplo = ['porta', 'patioAberto', 'patioColunas', 'santuario'].filter(key => listaPermitida.includes(key));

                            return (
                              <>
                                {listaGeral.map(key => <li key={key}><strong>{dicionarioGeral[key]}</strong></li>)}
                                {listaTemplo.length > 0 && (
                                  <li key="templo-grupo"><strong>Templo: {listaTemplo.map(k => dicionarioTemplo[k]).join(', ')}</strong></li>
                                )}
                              </>
                            );
                          })()}
                        </ul>
                      </div>
                    )}    

                    {/* ESSA É A LINHA QUE VOCÊ PESQUISOU 👇 */}


                    {entry.eveningDone && (
                      <>
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>Em que falhei:</h4>
                          <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.whereIFailed}</p>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>O que fiz bem:</h4>
                          <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.whatIDidWell}</p>
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>O que deixei de fazer:</h4>
                          <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.whatILeftUndone}</p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
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
              <p style={{ margin: '0 0 1.5rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem', lineHeight: '1.6' }}>Para sua segurança, o diário será fechado em <strong style={{ color: '#e74c3c', fontSize: '1.3rem' }}>{logoutCountdown}</strong> segundos.</p>
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
                            style={{ width: '24px', height: '24px', cursor: 'pointer', accentcolor: isDark ? '#FFD700' : '#996515' }} 
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
    </div>
  );
}

export default App;