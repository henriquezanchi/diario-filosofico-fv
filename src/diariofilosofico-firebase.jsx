import React, { useState, useEffect } from 'react';
import { BookOpen, LogOut, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { auth, db } from './config/firebase-config';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  Timestamp 
} from 'firebase/firestore';

const DiarioFilosoficoFirebase = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Monitorar autenticação
  useEffect(() => {
    console.log('🔵 Iniciando monitoramento de autenticação...');

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🔵 Estado de autenticação mudou:', currentUser ? 'Logado' : 'Deslogado');

      if (currentUser) {
        console.log('✅ Usuário autenticado:', currentUser.email);
        setUser(currentUser);

        // Carregar dados do usuário
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            console.log('✅ Dados do usuário carregados:', userDoc.data());
          } else {
            console.log('⚠️ Criando documento do usuário...');
            await setDoc(doc(db, 'users', currentUser.uid), {
              email: currentUser.email,
              createdAt: Timestamp.now()
            });
            console.log('✅ Documento do usuário criado');
          }
        } catch (err) {
          console.error('❌ Erro ao carregar dados:', err);
        }
      } else {
        console.log('❌ Usuário não autenticado');
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      console.log('🔵 Limpando monitoramento de autenticação');
      unsubscribe();
    };
  }, []);

  // Registro
  const handleRegister = async (e) => {
    e.preventDefault();
    console.log('🔵 Iniciando registro...');
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      console.log('🔵 Criando usuário no Firebase Authentication...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Usuário criado:', userCredential.user.uid);

      console.log('🔵 Criando documento no Firestore...');
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        createdAt: Timestamp.now()
      });
      console.log('✅ Documento criado com sucesso!');

      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('❌ Erro no registro:', err);

      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido');
      } else if (err.code === 'auth/weak-password') {
        setError('Senha muito fraca');
      } else {
        setError(`Erro: ${err.message}`);
      }
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    console.log('🔵 Iniciando login...');
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      console.log('🔵 Fazendo login no Firebase...');
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Login realizado com sucesso!');

      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('❌ Erro no login:', err);

      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido');
      } else {
        setError(`Erro: ${err.message}`);
      }
    }
  };

  // Logout
  const handleLogout = async () => {
    console.log('🔵 Fazendo logout...');
    try {
      await signOut(auth);
      console.log('✅ Logout realizado');
    } catch (err) {
      console.error('❌ Erro no logout:', err);
    }
  };

  // Loading
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: '#f0e6d2',
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <BookOpen size={48} style={{ animation: 'pulse 2s infinite' }} />
          <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // Tela de Login/Registro
  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)',
        padding: '1rem',
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <BookOpen size={48} color="#8b7355" style={{ margin: '0 auto' }} />
            <h1 style={{ 
              fontFamily: 'Georgia, serif',
              color: '#2c1810',
              marginTop: '1rem',
              fontSize: '1.8rem'
            }}>
              Diário Filosófico
            </h1>
            <p style={{ color: '#6b5744', fontSize: '0.9rem', fontStyle: 'italic', marginTop: '0.5rem' }}>
              Versão com Firebase
            </p>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister}>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                border: '2px solid #8b7355',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'Georgia, serif'
              }}
            />

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '3rem',
                  border: '2px solid #8b7355',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'Georgia, serif'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                {showPassword ? <EyeOff size={20} color="#8b7355" /> : <Eye size={20} color="#8b7355" />}
              </button>
            </div>

            {error && (
              <div style={{ 
                background: '#fee', 
                color: '#c33', 
                padding: '0.75rem', 
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                border: '1px solid #fcc',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#8b7355',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: '1rem',
                fontFamily: 'Georgia, serif'
              }}
            >
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                color: '#8b7355',
                border: '2px solid #8b7355',
                borderRadius: '8px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'Georgia, serif'
              }}
            >
              {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // App Principal
  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0e6d2 0%, #e8dcc4 100%)',
      padding: '2rem',
      fontFamily: 'Georgia, serif'
    }}>
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1rem',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <BookOpen size={32} color="#8b7355" />
          <div>
            <h1 style={{ 
              fontFamily: 'Georgia, serif',
              color: '#2c1810',
              margin: 0,
              fontSize: '1.5rem'
            }}>
              Diário Filosófico
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b5744' }}>
              Firebase funcionando! ✅
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            background: '#8b7355',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'Georgia, serif'
          }}
        >
          <LogOut size={16} />
          Sair
        </button>
      </header>

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        padding: '2rem',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          fontFamily: 'Georgia, serif',
          color: '#2c1810',
          textAlign: 'center',
          marginBottom: '1rem'
        }}>
          Bem-vindo, {user.email}!
        </h2>

        <div style={{
          background: '#e8f5e9',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '2px solid #4caf50'
        }}>
          <h3 style={{ color: '#2e7d32', marginBottom: '1rem' }}>
            ✅ Firebase Conectado com Sucesso!
          </h3>
          <ul style={{ color: '#1b5e20', lineHeight: '1.8' }}>
            <li>✅ Autenticação funcionando</li>
            <li>✅ Firestore conectado</li>
            <li>✅ Dados sendo salvos na nuvem</li>
            <li>✅ Pronto para adicionar funcionalidades</li>
          </ul>
        </div>

        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#fff3cd',
          borderRadius: '12px',
          border: '2px solid #ffc107'
        }}>
          <h4 style={{ color: '#856404', marginBottom: '0.5rem' }}>
            📝 Próximos Passos:
          </h4>
          <p style={{ color: '#856404', margin: 0 }}>
            Agora vamos adicionar o Prólogo, Epílogo e todas as funcionalidades que você pediu!
          </p>
        </div>
      </main>
    </div>
  );
};

export default DiarioFilosoficoFirebase;
