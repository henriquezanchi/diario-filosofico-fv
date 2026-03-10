import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Sunrise, Sunset, Search, Calendar, Moon, Sun, 
  Sparkles, ChevronRight, LogOut, Shuffle, Plus, X, 
  AlertCircle, Eye, EyeOff, CheckCircle, Download, Upload,
  Target, TrendingUp, Award, FileText, Book, Settings,
  Trash2, Edit, Save, XCircle, Flame
} from 'lucide-react';
import { auth, db } from './config/firebase-config';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import './App.css';

function App() {
  // Estados de Autenticação
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados de Navegação e Fogo Interno
  const [view, setView] = useState('today');
  const [theme, setTheme] = useState('light');
  const [searchTerm, setSearchTerm] = useState('');
  const [streak, setStreak] = useState(0); 
  const [longestStreak, setLongestStreak] = useState(0); 
  const [showStreakModal, setShowStreakModal] = useState(false); 

  // Inatividade
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(15);

  // Estados do Prólogo
  const [morningDone, setMorningDone] = useState(false);
  const [selectedVirtue, setSelectedVirtue] = useState('');
  const [customVirtue, setCustomVirtue] = useState('');
  const [showCustomVirtue, setShowCustomVirtue] = useState(false);
  const [dailyQuote, setDailyQuote] = useState(null);
  const [dailyIntention, setDailyIntention] = useState('');
  const [morningChallenges, setMorningChallenges] = useState(''); 
  const [morningVehicles, setMorningVehicles] = useState(''); 
  const [lastDrawDate, setLastDrawDate] = useState(null);

  // Estados do Epílogo
  const [eveningDone, setEveningDone] = useState(false);
  const [didMorning, setDidMorning] = useState(true); 
  const [whereIFailed, setWhereIFailed] = useState('');
  const [whatIDidWell, setWhatIDidWell] = useState('');
  const [whatILeftUndone, setWhatILeftUndone] = useState('');

  // Estados de Tarefas Personalizadas
  const [customTasks, setCustomTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [todayTasksStatus, setTodayTasksStatus] = useState({});
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('daily');
  const [newTaskWeekDays, setNewTaskWeekDays] = useState([]); 
  const [newTaskMonthDay, setNewTaskMonthDay] = useState(1);
  const [newTaskBaseDate, setNewTaskBaseDate] = useState(''); 
  const [editingTaskId, setEditingTaskId] = useState(null);

  // Estados de Metas de Longo Prazo
  const [yearGoals, setYearGoals] = useState('');
  const [lifeGoals, setLifeGoals] = useState('');
  const [showGoalsEditor, setShowGoalsEditor] = useState(false);

  // Estados de Biblioteca de Virtudes
  const [selectedVirtueDetail, setSelectedVirtueDetail] = useState(null);

  // Estados de Histórico
  const [entries, setEntries] = useState([]);

  // Estados FV
  const [fvUnlocked, setFvUnlocked] = useState(false);
  const [fvClickCount, setFvClickCount] = useState(0);
  const [fvCartaDegrau, setFvCartaDegrau] = useState('');
  const [fvLastCartaDate, setFvLastCartaDate] = useState(null);
  const [fvNextCartaDate, setFvNextCartaDate] = useState(null);
  const [fvGdveDesafios, setFvGdveDesafios] = useState([]);
  const [fvGdveReuniao, setFvGdveReuniao] = useState('');
  const [fvLockClickCount, setFvLockClickCount] = useState(0); // NOVO: Contador para bloquear

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

  const canDrawToday = () => {
    const today = getTodayKey();
    return lastDrawDate !== today;
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
    setFvCartaDegrau('');
    setFvGdveReuniao('');
    setFvLastCartaDate(null);
    setFvNextCartaDate(null);
    setFvUnlocked(false);
    setLastDrawDate(null);
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
      if (user) {
        updateDoc(doc(db, 'users', user.uid), { fvUnlocked: true });
      }
      alert('🔓 Modo FV desbloqueado!');
    }
    setTimeout(() => setFvClickCount(0), 3000);
  };

  // NOVO: Função para BLOQUEAR o FV novamente (3 cliques rápidos)
  const handleFvLockClick = () => {
    setView('fv'); // No primeiro clique, ele continua funcionando normal e entra na tela

    setFvLockClickCount(prev => prev + 1);
    
    // Se o contador chegar a 2 (ou seja, é o 3º clique seguido)
    if (fvLockClickCount >= 2) {
      setFvUnlocked(false); // Tranca a porta
      setView('today'); // Expulsa a pessoa para a tela inicial
      setFvLockClickCount(0); // Zera o contador
      
      if (user) {
        // Salva no banco de dados que a porta está trancada de novo
        updateDoc(doc(db, 'users', user.uid), { fvUnlocked: false });
      }
      alert('🔒 Modo FV ocultado com segurança!');
    }
    
    // Zera o contador se os cliques não forem rápidos (menos de 2 segundos)
    setTimeout(() => setFvLockClickCount(0), 2000); 
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
      try {
        await updateDoc(doc(db, 'users', user.uid), { lastDrawDate: today });
      } catch (error) {
        console.log('Erro ao salvar data do sorteio');
      }
    }
  };

  // Motor de Inatividade 1: O Vigia (60 segundos)
  useEffect(() => {
    if (!user || showInactivityWarning) return;

    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowInactivityWarning(true);
      }, 60000); // 1 minuto
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
  }, [user, showInactivityWarning]);

  // Motor de Inatividade 2: O Cronômetro de Expulsão (15 segundos)
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
      } else {
        await setDoc(doc(db, 'users', uid), {
          createdAt: Timestamp.now(),
          theme: 'light',
          lastDrawDate: null,
          fvUnlocked: false
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
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
        setMorningChallenges(data.morningChallenges || '');
        setMorningVehicles(data.morningVehicles || '');
        setEveningDone(data.eveningDone || false);
        setWhereIFailed(data.whereIFailed || '');
        setWhatIDidWell(data.whatIDidWell || '');
        setWhatILeftUndone(data.whatILeftUndone || '');
        setDidMorning(data.didMorning !== false);
        setDailyQuote(data.quote || null);
        setTodayTasksStatus(data.tasksStatus || {});
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
        if (data.eveningDone) {
          loadedEntries.push({ id: doc.id, ...data });
        }
      });
      loadedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEntries(loadedEntries);

      if (loadedEntries.length > 0) {
        let maxStreak = 1;
        let tempCalc = 1;
        for (let i = 0; i < loadedEntries.length - 1; i++) {
          const date1 = new Date(loadedEntries[i].date + 'T12:00:00');
          const date2 = new Date(loadedEntries[i+1].date + 'T12:00:00');
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
        let dateToCheck = loadedEntries[0].date === todayKey ? todayKey : (loadedEntries[0].date === yesterdayKey ? yesterdayKey : null);
        
        if (dateToCheck) {
          for (const entry of loadedEntries) {
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
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
    }
  };

  const loadCustomTasks = async (uid) => {
    try {
      const tasksDoc = await getDoc(doc(db, 'customTasks', uid));
      if (tasksDoc.exists()) {
        setCustomTasks(tasksDoc.data().tasks || []);
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
    }
  };

  const loadLongTermGoals = async (uid) => {
    try {
      const goalsDoc = await getDoc(doc(db, 'longTermGoals', uid));
      if (goalsDoc.exists()) {
        const data = goalsDoc.data();
        setYearGoals(data.yearGoals || '');
        setLifeGoals(data.lifeGoals || '');
      }
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    }
  };

  const loadFVData = async (uid) => {
    try {
      const fvDoc = await getDoc(doc(db, 'fvData', uid));
      if (fvDoc.exists()) {
        const data = fvDoc.data();
        setFvCartaDegrau(data.cartaDegrau || '');
        setFvLastCartaDate(data.lastCartaDate || null);
        setFvNextCartaDate(data.nextCartaDate || null);
        setFvGdveDesafios(data.gdveDesafios || []);
        setFvGdveReuniao(data.gdveReuniao || '');
      }
    } catch (error) {
      console.error('Erro ao carregar dados FV:', error);
    }
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

    const isDuplicate = customTasks.some(t => 
      t.name.toLowerCase().trim() === newTaskName.trim().toLowerCase() && 
      t.id !== editingTaskId
    );

    if (isDuplicate) {
      alert('Você já tem uma prática cadastrada com este nome!');
      return;
    }

    const uniqueId = editingTaskId || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const taskData = {
      id: uniqueId, 
      name: newTaskName.trim(),
      recurrence: newTaskRecurrence,
      weekDays: newTaskRecurrence === 'weekly' ? newTaskWeekDays : [],
      monthDay: newTaskRecurrence === 'monthly' ? parseInt(newTaskMonthDay) || 1 : 1,
      baseDate: newTaskRecurrence === 'biweekly' ? newTaskBaseDate : ""
    };

    let newTasks;
    if (editingTaskId) {
      newTasks = customTasks.map(t => t.id === editingTaskId ? taskData : t);
    } else {
      newTasks = [...customTasks, taskData];
    }

    const cleanTasksForFirebase = JSON.parse(JSON.stringify(newTasks));

    setCustomTasks(cleanTasksForFirebase);
    
    setNewTaskName('');
    setShowAddTask(false);
    setEditingTaskId(null);
    setNewTaskRecurrence('daily');
    setNewTaskWeekDays([]);
    setNewTaskMonthDay(1);
    setNewTaskBaseDate('');

    if (user) {
      try {
        await setDoc(doc(db, 'customTasks', user.uid), { tasks: cleanTasksForFirebase });
      } catch (error) {
        console.error("Erro ao salvar:", error);
        alert('O Firebase reclamou de algo, mas a tarefa está salva no seu dispositivo.');
      }
    }
  };

  const startEditingTask = (task) => {
    setEditingTaskId(task.id);
    setNewTaskName(task.name);
    setNewTaskRecurrence(task.recurrence || 'daily');
    setNewTaskWeekDays(task.weekDays || []);
    setNewTaskMonthDay(task.monthDay || 1);
    setNewTaskBaseDate(task.baseDate || ''); 
    setShowAddTask(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeCustomTask = async (taskId) => {
    const newTasks = customTasks.filter(t => t.id !== taskId);
    const cleanTasksForFirebase = JSON.parse(JSON.stringify(newTasks));
    
    setCustomTasks(cleanTasksForFirebase);

    if (user) {
      try {
        await setDoc(doc(db, 'customTasks', user.uid), { tasks: cleanTasksForFirebase });
      } catch (error) {
        console.error("Erro ao excluir:", error);
      }
    }
  };

  const toggleTaskStatus = async (taskId) => {
    const newStatus = {
      ...todayTasksStatus,
      [taskId]: !todayTasksStatus[taskId]
    };
    setTodayTasksStatus(newStatus);

    if (user) {
      const todayKey = getTodayKey();
      const updatedSnapshot = getTasksForToday().map(task => ({
        id: task.id,
        name: task.name,
        completed: !!newStatus[task.id]
      }));

      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), {
          tasksStatus: newStatus,
          tasksSnapshot: updatedSnapshot
        }, { merge: true }); 
        await loadAllEntries(user.uid);
      } catch (error) {
        console.error('Erro ao salvar o status da tarefa:', error);
      }
    }
  };  

  const saveMorning = async () => {
    const finalVirtue = showCustomVirtue ? customVirtue : selectedVirtue;

    if (!finalVirtue || !finalVirtue.trim()) {
      alert('Por favor, selecione ou digite uma virtude para o dia.');
      return;
    }

    const tasksSnapshot = getTasksForToday().map(task => ({
      id: task.id,
      name: task.name,
      completed: !!todayTasksStatus[task.id]
    }));

    const todayKey = getTodayKey();
    const entry = {
      userId: user.uid,
      date: todayKey,
      morningDone: true,
      virtue: finalVirtue,
      customVirtue: showCustomVirtue ? customVirtue : '',
      quote: dailyQuote || null,
      intention: dailyIntention || '',
      morningChallenges: morningChallenges || '', 
      morningVehicles: morningVehicles || '',     
      tasksStatus: todayTasksStatus || {},
      tasksSnapshot: tasksSnapshot || [],
      morningTimestamp: Timestamp.now()
    };

    try {
      await setDoc(doc(db, 'entries', `${user.uid}_${todayKey}`), entry, { merge: true });
      setMorningDone(true);
      alert('✅ Prólogo salvo com sucesso!');
    } catch (error) {
      console.error(error); 
      alert('Erro ao salvar prólogo. Verifique sua conexão.');
    }
  };

  const saveEvening = async () => {
    if (!whereIFailed || !whereIFailed.trim() || 
        !whatIDidWell || !whatIDidWell.trim() || 
        !whatILeftUndone || !whatILeftUndone.trim()) {
      alert('Por favor, responda todas as três perguntas do exame noturno.');
      return;
    }

    const todayKey = getTodayKey();
    const tasksSnapshot = getTasksForToday().map(task => ({
      id: task.id,
      name: task.name,
      completed: !!todayTasksStatus[task.id]
    }));

    try {
      const entryRef = doc(db, 'entries', `${user.uid}_${todayKey}`);
      const existing = await getDoc(entryRef);
      const existingData = existing.exists() ? existing.data() : {};

      const updatedEntry = {
        ...existingData, 
        userId: user.uid,
        date: todayKey,
        eveningDone: true,
        whereIFailed: whereIFailed || '',
        whatIDidWell: whatIDidWell || '',
        whatILeftUndone: whatILeftUndone || '',
        didMorning: didMorning !== false, 
        tasksStatus: todayTasksStatus || {},
        tasksSnapshot: tasksSnapshot || [],
        eveningTimestamp: Timestamp.now()
      };

      await setDoc(entryRef, updatedEntry, { merge: true });
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
        await setDoc(doc(db, 'longTermGoals', user.uid), {
          yearGoals,
          lifeGoals,
          updatedAt: Timestamp.now()
        });
        setShowGoalsEditor(false);
        alert('✅ Metas salvas com sucesso!');
      } catch (error) {
        alert('Erro ao salvar metas.');
      }
    }
  };

  const saveFVData = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'fvData', user.uid), {
          cartaDegrau: fvCartaDegrau,
          lastCartaDate: fvLastCartaDate,
          nextCartaDate: fvNextCartaDate,
          gdveDesafios: fvGdveDesafios,
          gdveReuniao: fvGdveReuniao,
          updatedAt: Timestamp.now()
        });
        alert('✅ Dados FV salvos!');
      } catch (error) {
        alert('Erro ao salvar dados FV.');
      }
    }
  };

  const deleteEntry = async (dateKey) => {
    if (!window.confirm('Deseja realmente excluir este dia?')) return;
    try {
      await deleteDoc(doc(db, 'entries', `${user.uid}_${dateKey}`));
      setEntries(entries.filter(e => e.date !== dateKey));
    } catch (error) {
      alert('Erro ao excluir entrada.');
    }
  };

  const exportToCSV = () => {
    if (entries.length === 0) {
      alert('Não há entradas para exportar');
      return;
    }
    const headers = ['Data', 'Fez Prólogo', 'Virtude', 'Compromisso', 'Onde Errei', 'O Que Fiz Bem', 'O Que Deixei de Fazer'];
    const rows = entries.map(entry => [
      entry.date,
      entry.didMorning ? 'Sim' : 'Não',
      entry.virtue || '',
      entry.intention || '',
      entry.whereIFailed || '',
      entry.whatIDidWell || '',
      entry.whatILeftUndone || ''
    ]);

    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `diario-filosofico-${getTodayKey()}.csv`;
    link.click();
  };

  const importDiary = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        if (file.name.endsWith('.csv')) {
          await importFromCSV(content);
        } else if (file.name.endsWith('.json')) {
          await importFromJSON(content);
        } else if (file.name.endsWith('.txt')) {
          await importFromTXT(content);
        } else {
          alert('Formato não suportado. Use CSV, JSON ou TXT.');
        }
      } catch (error) {
        alert('Erro ao importar arquivo.');
      }
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
      const entry = {
        userId: user.uid, date, didMorning: didMorningStr === 'Sim',
        virtue, intention, whereIFailed, whatIDidWell, whatILeftUndone,
        morningDone: true, eveningDone: true, importedAt: Timestamp.now()
      };

      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${date}`), entry);
        imported++;
      } catch (error) {
        console.error(`Erro ao importar ${date}`);
      }
    }
    await loadAllEntries(user.uid);
    alert(`✅ ${imported} entradas importadas com sucesso!`);
  };

  const importFromJSON = async (content) => {
    const data = JSON.parse(content);
    let imported = 0;
    for (const entry of data) {
      if (!entry.date) continue;
      const newEntry = { ...entry, userId: user.uid, importedAt: Timestamp.now() };
      try {
        await setDoc(doc(db, 'entries', `${user.uid}_${entry.date}`), newEntry);
        imported++;
      } catch (error) {
        console.error(`Erro ao importar ${entry.date}`);
      }
    }
    await loadAllEntries(user.uid);
    alert(`✅ ${imported} entradas importadas com sucesso!`);
  };

  const importFromTXT = async (content) => {
    const entriesText = content.split('---');
    let imported = 0;
    for (const entryText of entriesText) {
      if (!entryText.trim()) continue;
      const lines = entryText.trim().split('\n');
      const entry = {
        userId: user.uid, date: getTodayKey(), whereIFailed: '', whatIDidWell: '',
        whatILeftUndone: '', morningDone: false, eveningDone: true, importedAt: Timestamp.now()
      };
      lines.forEach(line => {
        if (line.startsWith('Data:')) entry.date = line.replace('Data:', '').trim();
        if (line.startsWith('Virtude:')) entry.virtue = line.replace('Virtude:', '').trim();
        if (line.startsWith('Onde errei:')) entry.whereIFailed = line.replace('Onde errei:', '').trim();
        if (line.startsWith('O que fiz bem:')) entry.whatIDidWell = line.replace('O que fiz bem:', '').trim();
        if (line.startsWith('O que deixei:')) entry.whatILeftUndone = line.replace('O que deixei:', '').trim();
      });
      if (entry.date && entry.whereIFailed) {
        try {
          await setDoc(doc(db, 'entries', `${user.uid}_${entry.date}`), entry);
          imported++;
        } catch (error) {
          console.error(`Erro ao importar ${entry.date}`);
        }
      }
    }
    await loadAllEntries(user.uid);
    alert(`✅ ${imported} entradas importadas com sucesso!`);
  };

  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError('Erro ao fazer login com o Google. Verifique se ativou no Firebase.');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres');
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Este e-mail já está em uso');
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') setError('E-mail ou senha incorretos');
      else if (err.code === 'auth/invalid-email') setError('E-mail inválido');
      else setError('Erro ao autenticar. Tente novamente.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('today');
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { theme: newTheme });
    }
  };

  const filteredEntries = entries.filter(entry =>
    (entry.whereIFailed && entry.whereIFailed.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.whatIDidWell && entry.whatIDidWell.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.whatILeftUndone && entry.whatILeftUndone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.virtue && entry.virtue.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isDark = theme === 'dark';

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)',
        color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: 'Georgia, serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <BookOpen size={48} />
          <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)', padding: '1rem'
      }}>
        <div style={{
          background: 'white', padding: '2rem', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <BookOpen size={48} color="#8b7355" style={{ margin: '0 auto' }} />
            <h1 style={{ fontFamily: 'Georgia, serif', color: '#2c1810', marginTop: '1rem', fontSize: '1.8rem' }}>
              Diário Filosófico
            </h1>
            <p style={{ color: '#6b5744', fontSize: '0.9rem', fontStyle: 'italic', marginTop: '0.5rem' }}>
              "Examina tua vida diariamente"
            </p>
          </div>

          <form onSubmit={handleAuth}>
            <input
              type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #8b7355', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif' }}
            />
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '0.75rem', paddingRight: '3rem', border: '2px solid #8b7355', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif' }}
              />
              <button
                type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
              >
                {showPassword ? <EyeOff size={20} color="#8b7355" /> : <Eye size={20} color="#8b7355" />}
              </button>
            </div>

            {error && (
              <div style={{ background: '#fee', color: '#c33', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1rem', border: '1px solid #fcc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              style={{ width: '100%', padding: '0.75rem', background: '#8b7355', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', fontFamily: 'Georgia, serif', transition: 'all 0.2s' }}
            >
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
            <button
              type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }}
              style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#8b7355', border: '2px solid #8b7355', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.2s' }}
            >
              {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: '#8b7355' }}>
              <div style={{ flex: 1, height: '1px', background: '#e8dcc4' }}></div>
              <span style={{ padding: '0 1rem', fontSize: '0.9rem', fontStyle: 'italic' }}>ou</span>
              <div style={{ flex: 1, height: '1px', background: '#e8dcc4' }}></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              style={{ 
                width: '100%', padding: '0.75rem', background: '#fff', color: '#444', 
                border: '1px solid #ccc', borderRadius: '8px', fontSize: '1rem', 
                fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', 
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)' 
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style={{ width: '20px', height: '20px' }} />
              Entrar com o Google
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)',
      fontFamily: 'Georgia, serif', transition: 'background 0.3s ease'
    }}>
      <header style={{
        padding: '1rem 2rem', borderBottom: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`,
        background: isDark ? 'rgba(26, 26, 46, 0.95)' : 'rgba(240, 230, 210, 0.95)',
        backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div onClick={handleLogoClick} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <BookOpen size={32} color={isDark ? '#d4af37' : '#8b7355'} />
            <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 700 }}>
              Diário Filosófico <span style={{ fontWeight: 'normal', fontStyle: 'italic', fontSize: '0.85em', opacity: 0.9 }}>de {getUserFirstName()}</span>
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {streak > 0 && (
              <div 
                onClick={() => setShowStreakModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
                  background: isDark ? 'rgba(255, 100, 0, 0.15)' : '#fff3e0', border: `1px solid ${isDark ? '#ff9800' : '#ffb74d'}`,
                  borderRadius: '20px', color: isDark ? '#ffb74d' : '#e65100', fontWeight: 'bold',
                  fontFamily: 'Georgia, serif', fontSize: '0.9rem', marginRight: '0.5rem', cursor: 'pointer',
                  boxShadow: isDark ? '0 0 10px rgba(255, 152, 0, 0.2)' : 'none'
                }}>
                <Flame size={18} fill={isDark ? '#ff9800' : '#e65100'} color={isDark ? '#ff9800' : '#e65100'} />
                <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
              </div>
            )}

            <button onClick={() => setView('today')} style={{ padding: '0.5rem 1rem', background: view === 'today' ? (isDark ? '#d4af37' : '#8b7355') : 'transparent', color: view === 'today' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#8b7355'), border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Hoje</button>
            <button onClick={() => setView('history')} style={{ padding: '0.5rem 1rem', background: view === 'history' ? (isDark ? '#d4af37' : '#8b7355') : 'transparent', color: view === 'history' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#8b7355'), border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Histórico</button>
            <button onClick={() => setView('tasks')} style={{ padding: '0.5rem 1rem', background: view === 'tasks' ? (isDark ? '#d4af37' : '#8b7355') : 'transparent', color: view === 'tasks' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#8b7355'), border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Tarefas</button>
            <button onClick={() => setView('goals')} style={{ padding: '0.5rem 1rem', background: view === 'goals' ? (isDark ? '#d4af37' : '#8b7355') : 'transparent', color: view === 'goals' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#8b7355'), border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Metas</button>
            <button onClick={() => setView('biblioteca')} style={{ padding: '0.5rem 1rem', background: view === 'biblioteca' ? (isDark ? '#d4af37' : '#8b7355') : 'transparent', color: view === 'biblioteca' ? (isDark ? '#1a1a2e' : '#f0e6d2') : (isDark ? '#d4af37' : '#8b7355'), border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600 }}>Virtudes</button>

            {fvUnlocked && (
              <button 
                onClick={handleFvLockClick} 
                style={{ padding: '0.5rem 1rem', background: view === 'fv' ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 'transparent', color: view === 'fv' ? '#000' : '#FFD700', border: '2px solid #FFD700', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}
              >
                FV
              </button>
            )}

            <button onClick={toggleTheme} style={{ padding: '0.5rem', background: 'transparent', border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isDark ? <Sun size={20} color="#d4af37" /> : <Moon size={20} color="#8b7355" />}
            </button>

            <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: 'transparent', color: isDark ? '#d4af37' : '#8b7355', border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LogOut size={16} /> <span style={{ display: window.innerWidth > 768 ? 'inline' : 'none' }}>Sair</span>
            </button>
          </div>
        </div>
      </header>

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
                      <button onClick={selectRandomVirtue} disabled={!canDrawToday()} style={{ padding: '0.75rem 1.5rem', background: canDrawToday() ? (isDark ? '#d4af37' : '#8b7355') : (isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'), color: canDrawToday() ? 'white' : (isDark ? '#888' : '#999'), border: 'none', borderRadius: '8px', cursor: canDrawToday() ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
                        <Shuffle size={18} /> {canDrawToday() ? 'Sortear Virtude' : 'Já sorteou hoje'}
                      </button>
                      <button onClick={() => setShowCustomVirtue(!showCustomVirtue)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: isDark ? '#d4af37' : '#8b7355', border: `2px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
                        {showCustomVirtue ? 'Escolher da Lista' : 'Escrever Própria'}
                      </button>
                    </div>

                    {showCustomVirtue ? (
                      <input type="text" placeholder="Digite sua virtude..." value={customVirtue} onChange={(e) => setCustomVirtue(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    ) : (
                      <select value={selectedVirtue} onChange={(e) => setSelectedVirtue(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                        <option value="">Selecione uma virtude...</option>
                        {virtues.map((v, idx) => <option key={idx} value={v.name}>{v.name}</option>)}
                      </select>
                    )}

                    {selectedVirtue && !showCustomVirtue && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.5)', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#d4af37' : '#8b7355' }}>{selectedVirtue}</h4>
                        <p style={{ margin: '0.5rem 0', fontSize: '0.95rem', color: isDark ? '#c8b896' : '#6b5744' }}>{virtues.find(v => v.name === selectedVirtue)?.shortDesc}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>Meu compromisso para hoje:</label>
                    <textarea value={dailyIntention} onChange={(e) => setDailyIntention(e.target.value)} placeholder="Como vou praticar esta virtude hoje?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <button onClick={saveMorning} style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#8b7355', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: 'clamp(1rem, 2vw, 1.1rem)', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
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
                    <textarea value={whereIFailed} onChange={(e) => setWhereIFailed(e.target.value)} placeholder="Onde não agi conforme meus princípios?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>2. O que fiz bem?</label>
                    <textarea value={whatIDidWell} onChange={(e) => setWhatIDidWell(e.target.value)} placeholder="Quais virtudes pratiquei?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: isDark ? '#f0e6d2' : '#2c1810' }}>3. O que deixei de fazer?</label>
                    <textarea value={whatILeftUndone} onChange={(e) => setWhatILeftUndone(e.target.value)} placeholder="O que poderia ter feito melhor?" rows={4} style={{ width: '100%', padding: '0.75rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical' }} />
                  </div>

                  <button onClick={saveEvening} style={{ width: '100%', padding: '1rem', background: isDark ? '#b19cd9' : '#9c27b0', color: 'white', border: 'none', borderRadius: '8px', fontSize: 'clamp(1rem, 2vw, 1.1rem)', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={20} /> Salvar Epílogo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: TASKS - Tarefas Personalizadas */}
        {view === 'tasks' && (
          <div className="animate-fadeIn">
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>
                  Tarefas Personalizadas
                </h2>
                <button
                  onClick={() => {
                    setEditingTaskId(null);
                    setNewTaskName('');
                    setNewTaskRecurrence('daily');
                    setNewTaskWeekDays([]);
                    setNewTaskMonthDay(1);
                    setNewTaskBaseDate('');
                    setShowAddTask(true);
                  }}
                  style={{ padding: '0.75rem 1.5rem', background: isDark ? '#d4af37' : '#8b7355', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Plus size={18} /> Nova Tarefa
                </button>
              </div>

              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem' }}>
                Cadastre práticas que deseja acompanhar (ex: Tratak, Meditação, Leitura, Exercícios)
              </p>

              {showAddTask && (
                <div style={{ padding: '1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '12px', marginBottom: '2rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: isDark ? '#d4af37' : '#8b7355', fontFamily: "'Cinzel', serif" }}>
                      {editingTaskId ? 'Editar Prática' : 'Nova Prática'}
                    </h3>
                    <button onClick={() => { setShowAddTask(false); setEditingTaskId(null); }} style={{ background: 'transparent', color: '#e74c3c', border: 'none', cursor: 'pointer' }}>
                      <X size={24} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Nome da prática (ex: Tratak, Meditação...)" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontSize: '1rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: isDark ? '#d4af37' : '#8b7355', fontWeight: 'bold' }}>Periodicidade:</label>
                    <select value={newTaskRecurrence} onChange={(e) => setNewTaskRecurrence(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }}>
                      <option value="daily">Diariamente</option>
                      <option value="weekly">Dias da Semana Específicos</option>
                      <option value="biweekly">Quinzenalmente (A cada 14 dias)</option>
                      <option value="monthly">Uma vez ao Mês</option>
                    </select>
                  </div>

                  {newTaskRecurrence === 'weekly' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                        <button key={idx} onClick={() => { if (newTaskWeekDays.includes(idx)) { setNewTaskWeekDays(newTaskWeekDays.filter(d => d !== idx)); } else { setNewTaskWeekDays([...newTaskWeekDays, idx]); } }} style={{ padding: '0.5rem', flex: 1, minWidth: '40px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', background: newTaskWeekDays.includes(idx) ? (isDark ? '#d4af37' : '#8b7355') : 'transparent', color: newTaskWeekDays.includes(idx) ? (isDark ? '#1a1a2e' : 'white') : (isDark ? '#b8a88a' : '#8b7355'), border: `1px solid ${isDark ? '#d4af37' : '#8b7355'}` }}>
                          {day}
                        </button>
                      ))}
                    </div>
                  )}

                  {newTaskRecurrence === 'biweekly' && (
                    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '0.9rem' }}>Qual é a data do próximo encontro/prática?</label>
                      <input type="date" value={newTaskBaseDate || ''} onChange={(e) => setNewTaskBaseDate(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                  )}

                  {newTaskRecurrence === 'monthly' && (
                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: isDark ? '#f0e6d2' : '#2c1810' }}>Todo dia:</span>
                      <input type="number" min="1" max="31" value={newTaskMonthDay} onChange={(e) => setNewTaskMonthDay(e.target.value)} style={{ width: '60px', padding: '0.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                    </div>
                  )}

                  <button onClick={saveCustomTask} style={{ width: '100%', padding: '0.75rem', background: isDark ? '#d4af37' : '#8b7355', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
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
                      if (task.baseDate) {
                        const [y, m, d] = task.baseDate.split('-');
                        freqText = `Quinzenal (a partir de ${d}/${m})`;
                      } else {
                        freqText = 'Quinzenalmente';
                      }
                    } else if (task.recurrence === 'monthly') {
                      freqText = `Todo dia ${task.monthDay}`;
                    }

                    return (
                      <div key={task.id} style={{ padding: '1rem', background: isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', color: isDark ? '#f0e6d2' : '#2c1810', fontWeight: 'bold' }}>{task.name}</div>
                          <div style={{ fontSize: '0.85rem', color: isDark ? '#d4af37' : '#8b7355', marginTop: '0.2rem' }}>↻ {freqText}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => startEditingTask(task)} style={{ padding: '0.5rem', background: 'transparent', color: isDark ? '#d4af37' : '#8b7355', border: `1px solid ${isDark ? '#d4af37' : '#8b7355'}`, borderRadius: '6px', cursor: 'pointer', display: 'flex' }} title="Editar">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => { if(window.confirm(`Deseja realmente excluir a prática "${task.name}"?`)) { removeCustomTask(task.id); } }} style={{ padding: '0.5rem', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '6px', cursor: 'pointer', display: 'flex' }} title="Excluir">
                            <Trash2 size={16} />
                          </button>
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
                <Target size={32} color={isDark ? '#d4af37' : '#8b7355'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>Metas de Longo Prazo</h2>
              </div>
              <p style={{ color: isDark ? '#b8a88a' : '#6b5744', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>"Amanhã" - Descreva como você deseja ser no futuro</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#d4af37' : '#8b7355', fontFamily: "'Cinzel', serif" }}>Metas para Este Ano</label>
                  <textarea value={yearGoals} onChange={(e) => setYearGoals(e.target.value)} placeholder="Como você quer estar no final deste ano? Que virtudes quer ter desenvolvido? Que objetivos quer alcançar?" rows={6} style={{ width: '100%', padding: '1rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', lineHeight: '1.7' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: isDark ? '#d4af37' : '#8b7355', fontFamily: "'Cinzel', serif" }}>Visão de Longo Prazo (Vida)</label>
                  <textarea value={lifeGoals} onChange={(e) => setLifeGoals(e.target.value)} placeholder="Qual é sua visão maior? Que tipo de pessoa você quer ser? Que legado quer deixar?" rows={8} style={{ width: '100%', padding: '1rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', lineHeight: '1.7' }} />
                </div>
                <button onClick={saveLongTermGoals} style={{ padding: '1rem 2rem', background: isDark ? '#d4af37' : '#8b7355', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', alignSelf: 'flex-end' }}>
                  <Save size={20} /> Salvar Metas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: BIBLIOTECA */}
        {view === 'biblioteca' && (
          <div className="animate-fadeIn">
            <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '2rem', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Book size={32} color={isDark ? '#d4af37' : '#8b7355'} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Award size={32} color="#FFD700" />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: '#FFD700', fontFamily: "'Cinzel', serif" }}>Seção FV</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: '#FFD700', fontFamily: "'Cinzel', serif" }}>Carta de Degrau</label>
                  <textarea value={fvCartaDegrau} onChange={(e) => setFvCartaDegrau(e.target.value)} placeholder="Cole aqui o conteúdo da sua carta de degrau..." rows={8} style={{ width: '100%', padding: '1rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810', resize: 'vertical', lineHeight: '1.7' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#FFD700' }}>Última Entrega</label>
                    <input type="date" value={fvLastCartaDate || ''} onChange={(e) => setFvLastCartaDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#FFD700' }}>Próxima Entrega Prevista</label>
                    <input type="date" value={fvNextCartaDate || ''} onChange={(e) => setFvNextCartaDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '1.1rem', color: '#FFD700', fontFamily: "'Cinzel', serif" }}>Próxima Reunião GDVE</label>
                  <input type="datetime-local" value={fvGdveReuniao || ''} onChange={(e) => setFvGdveReuniao(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
                </div>
                <button onClick={saveFVData} style={{ padding: '1rem 2rem', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', alignSelf: 'flex-end', boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)' }}>
                  <Save size={20} /> Salvar Dados FV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: HISTORY */}
        {view === 'history' && (
          <div className="animate-fadeIn">
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.5rem', color: isDark ? '#d4af37' : '#8b7355', margin: 0 }}>Histórico de Reflexões</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={exportToCSV} disabled={entries.length === 0} style={{ padding: '0.75rem 1.5rem', background: entries.length > 0 ? (isDark ? '#d4af37' : '#8b7355') : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: entries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={18} /> Exportar CSV
                </button>
                <label style={{ padding: '0.75rem 1.5rem', background: isDark ? '#d4af37' : '#8b7355', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={18} /> Importar
                  <input type="file" accept=".csv,.json,.txt" onChange={importDiary} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <Search size={20} color={isDark ? '#d4af37' : '#8b7355'} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Buscar nas reflexões..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 3rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : '#8b7355'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: isDark ? 'rgba(26, 26, 46, 0.8)' : 'white', color: isDark ? '#f0e6d2' : '#2c1810' }} />
            </div>

            {filteredEntries.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', borderRadius: '16px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                <Calendar size={48} color={isDark ? '#d4af37' : '#8b7355'} style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem' }}>{searchTerm ? 'Nenhuma entrada encontrada' : 'Nenhuma reflexão registrada ainda'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredEntries.map((entry) => (
                  <div key={entry.id} style={{ background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', padding: '1.5rem', borderRadius: '12px', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: isDark ? '#d4af37' : '#8b7355', fontSize: '1.2rem' }}>
                          {new Date(entry.date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h3>
                        {entry.virtue && <p style={{ margin: '0.25rem 0 0 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.9rem' }}>Virtude: <strong>{entry.virtue}</strong></p>}
                        {!entry.didMorning && <p style={{ margin: '0.25rem 0 0 0', color: '#ff9800', fontSize: '0.85rem', fontStyle: 'italic' }}>⚠️ Prólogo não realizado</p>}
                      </div>
                      <button onClick={() => deleteEntry(entry.date)} style={{ padding: '0.5rem', background: 'transparent', color: '#e74c3c', border: '2px solid #e74c3c', borderRadius: '8px', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>

                    {entry.intention && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>Compromisso:</h4>
                        <p style={{ margin: 0, color: isDark ? '#c8b896' : '#6b5744', lineHeight: '1.6' }}>{entry.intention}</p>
                      </div>
                    )}

                    {/* Exibição Completa das Tarefas no Histórico (Realizadas e Falhas) */}
                    {entry.tasksSnapshot && entry.tasksSnapshot.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        
                        {/* Verdes: Realizadas */}
                        {entry.tasksSnapshot.filter(t => t.completed).length > 0 && (
                          <div style={{ padding: '1rem', background: isDark ? 'rgba(76, 175, 80, 0.05)' : '#f8fff8', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#4caf50' : '#81c784'}` }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#81c784' : '#2e7d32', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <CheckCircle size={16} /> Práticas Realizadas:
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#c8b896' : '#4caf50', fontSize: '0.95rem', lineHeight: '1.6' }}>
                              {entry.tasksSnapshot.filter(t => t.completed).map((task, idx) => <li key={idx}>{task.name}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* Vermelhas: NÃO Realizadas */}
                        {entry.tasksSnapshot.filter(t => !t.completed).length > 0 && (
                          <div style={{ padding: '1rem', background: isDark ? 'rgba(244, 67, 54, 0.05)' : '#fff5f5', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#f44336' : '#e53935'}` }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#e57373' : '#c62828', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <XCircle size={16} /> Práticas Não Realizadas:
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? '#b8a88a' : '#c62828', fontSize: '0.95rem', lineHeight: '1.6', textDecoration: 'line-through', opacity: 0.8 }}>
                              {entry.tasksSnapshot.filter(t => !t.completed).map((task, idx) => <li key={idx}>{task.name}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL DO FOGO INTERNO (ESTATÍSTICAS) */}
        {showStreakModal && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }} 
            onClick={() => setShowStreakModal(false)}
          >
            <div 
              style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: `2px solid ${isDark ? '#ff9800' : '#e65100'}`, position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} 
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setShowStreakModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: isDark ? '#f0e6d2' : '#2c1810', cursor: 'pointer' }}><X size={24} /></button>
              
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <Flame size={48} fill={isDark ? '#ff9800' : '#e65100'} color={isDark ? '#ff9800' : '#e65100'} style={{ margin: '0 auto 1rem' }} />
                <h2 style={{ margin: 0, fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.8rem' }}>Seu Fogo Interno</h2>
                <p style={{ margin: '0.5rem 0 0', color: isDark ? '#b8a88a' : '#6b5744', fontStyle: 'italic' }}>A consistência forja o caráter.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: isDark ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.3)' : 'rgba(230, 81, 0, 0.2)'}` }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isDark ? '#ffb74d' : '#e65100' }}>{streak}</div>
                  <div style={{ fontSize: '0.75rem', color: isDark ? '#c8b896' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Dias Seguidos</div>
                </div>
                <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 245, 220, 0.6)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}` }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isDark ? '#d4af37' : '#8b7355' }}>{longestStreak}</div>
                  <div style={{ fontSize: '0.75rem', color: isDark ? '#c8b896' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Maior Ofensiva</div>
                </div>
              </div>

              <div style={{ background: isDark ? 'rgba(26, 26, 46, 0.5)' : 'white', padding: '1.2rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(139, 115, 85, 0.2)'}`, textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px' }}>Total de Dias Registrados</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: isDark ? '#d4af37' : '#8b7355' }}>
                  <BookOpen size={20} />
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>{entries.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE SEGURANÇA (INATIVIDADE) */}
        {showInactivityWarning && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }} 
          >
            <div 
              style={{ background: isDark ? '#1a1a2e' : '#fdfbf7', padding: '2.5rem', borderRadius: '16px', maxWidth: '450px', width: '100%', border: `2px solid #e74c3c`, textAlign: 'center', boxShadow: '0 10px 40px rgba(231, 76, 60, 0.4)' }} 
            >
              <AlertCircle size={56} color="#e74c3c" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ margin: '0 0 1rem 0', fontFamily: "'Cinzel', serif", color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1.5rem' }}>
                Você ainda está aí?
              </h2>
              <p style={{ margin: '0 0 1.5rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '1.1rem', lineHeight: '1.6' }}>
                Para sua segurança, o diário será fechado automaticamente em <strong style={{ color: '#e74c3c', fontSize: '1.3rem' }}>{logoutCountdown}</strong> segundos.
              </p>
              
              <button 
                onClick={keepAlive} 
                style={{ width: '100%', padding: '1rem', background: isDark ? '#d4af37' : '#8b7355', color: isDark ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
              >
                Continuar conectado
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