import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function DashboardCoordenador() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const [disciplinas, setDisciplinas] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [tutorados, setTutorados] = useState([]);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Formulários
  const [novaDisciplina, setNovaDisciplina] = useState({ nome: '', codigo: '' });
  const [novaMatricula, setNovaMatricula] = useState({
    aluno_matricula: '',
    professor_email: '',
    disciplina_codigo: '',
  });

  const [alunoSelecionadoMatricula, setAlunoSelecionadoMatricula] = useState('');

  // Modais de edição
  const [disciplinaEditando, setDisciplinaEditando] = useState(null);
  const [novoNomeDisciplina, setNovoNomeDisciplina] = useState('');
  const [matriculaEditando, setMatriculaEditando] = useState(null);
  const [novoProfessorEmail, setNovoProfessorEmail] = useState('');

  // Tema Claro/Escuro
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setTheme = (dark) => {
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // 1. CARREGAR DADOS DO BANCO
  const carregarDadosDoBanco = async () => {
    try {
      setLoading(true);
      setErro('');

      const [resDisciplinas, resProfessores, resMatriculas, resAlunos, resVinculos] = await Promise.all([
        api.get('/disciplinas/'),
        api.get('/auth/professores'),
        api.get('/matriculas/'),
        api.get('/auth/alunos').catch(() => ({ data: [] })),
        api.get('/acompanhamento/meus-vinculos').catch(() => ({ data: null })),
      ]);

      setDisciplinas(resDisciplinas.data || []);
      setProfessores(resProfessores.data || []);
      setMatriculas(resMatriculas.data || []);
      setAlunos(resAlunos.data || []);

      if (resVinculos.data) {
        if (Array.isArray(resVinculos.data)) {
          setTutorados(resVinculos.data);
        } else if (Array.isArray(resVinculos.data.tutorados)) {
          setTutorados(resVinculos.data.tutorados);
        } else if (Array.isArray(resVinculos.data.alunos)) {
          setTutorados(resVinculos.data.alunos);
        } else {
          setTutorados([]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        alert('Sessão expirada. Faça login novamente.');
        handleLogout();
        return;
      }
      setErro('Não foi possível carregar os dados do servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosDoBanco();
  }, []);

  // --- DISCIPLINAS ---
  const handleAddDisciplina = async (e) => {
    e.preventDefault();
    try {
      await api.post('/disciplinas/criar', {
        nome: novaDisciplina.nome.trim(),
        codigo: novaDisciplina.codigo.trim().toUpperCase(),
      });
      setNovaDisciplina({ nome: '', codigo: '' });
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao cadastrar disciplina.');
    }
  };

  const handleEditarNomeDisciplina = async (e) => {
    e.preventDefault();
    if (!novoNomeDisciplina.trim()) return;

    try {
      await api.patch(`/disciplinas/${disciplinaEditando.codigo}/nome`, {
        novo_nome: novoNomeDisciplina.trim(),
      });
      setDisciplinaEditando(null);
      setNovoNomeDisciplina('');
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao atualizar nome da disciplina.');
    }
  };

  const handleDeletarDisciplina = async (codigo) => {
    if (!confirm(`Atenção: Ao excluir ${codigo}, as matrículas ligadas a ela serão canceladas. Deseja continuar?`)) {
      return;
    }

    try {
      await api.delete(`/disciplinas/${codigo}`);
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao excluir disciplina.');
    }
  };

  // --- MATRÍCULAS ---
  const handleAddMatricula = async (e) => {
    e.preventDefault();
    try {
      await api.post('/matriculas/criar', {
        aluno_matricula: novaMatricula.aluno_matricula.trim(),
        professor_email: novaMatricula.professor_email,
        disciplina_codigo: novaMatricula.disciplina_codigo,
      });
      setNovaMatricula({ aluno_matricula: '', professor_email: '', disciplina_codigo: '' });
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao efetivar matrícula.');
    }
  };

  const handleMudarProfessor = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/matriculas/${matriculaEditando.id}/mudar-professor`, {
        novo_professor_email: novoProfessorEmail,
      });
      setMatriculaEditando(null);
      setNovoProfessorEmail('');
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao mudar professor.');
    }
  };

  const handleDeletarMatricula = async (id) => {
    if (!confirm('Deseja realmente cancelar esta matrícula?')) return;
    try {
      await api.delete(`/matriculas/${id}`);
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao cancelar matrícula.');
    }
  };

  // --- ASSUMIR TUTORIA ---
  const handleColocarSobTutoria = async (e) => {
    e.preventDefault();
    const matricula = alunoSelecionadoMatricula.trim();
    if (!matricula) {
      alert('Selecione ou digite a matrícula do aluno.');
      return;
    }

    try {
      await api.post('/acompanhamento/definir-coordenador-tutor', {
        aluno_matricula: matricula,
        matricula: matricula,
      });
      setAlunoSelecionadoMatricula('');
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao definir coordenador como tutor.');
    }
  };

  // --- CANCELAR/REMOVER TUTORIA ---
  const handleRemoverTutoria = async (matricula) => {
    if (!confirm(`Deseja remover o aluno ${matricula} da sua tutoria?`)) return;

    try {
      await api.delete(`/acompanhamento/remover-tutor/${matricula}`);
      carregarDadosDoBanco();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao remover aluno da tutoria.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-blue-900 dark:bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold">SAEI — Painel da Coordenação Pedagógica</h1>
          <p className="text-xs text-blue-200 dark:text-slate-400">Gestão Inclusiva e Acompanhamento</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Seletor de Tema Sol e Lua */}
          <div className="flex items-center bg-blue-800 dark:bg-slate-800 rounded-full p-1 border border-blue-700 dark:border-slate-700 space-x-1">
            <button
              type="button"
              onClick={() => setTheme(false)}
              className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ${
                !isDarkMode
                  ? 'bg-white text-amber-500 shadow-md scale-105'
                  : 'text-blue-200 hover:text-white'
              }`}
              title="Modo Claro"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setTheme(true)}
              className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ${
                isDarkMode
                  ? 'bg-slate-900 text-blue-400 shadow-md scale-105'
                  : 'text-blue-200 hover:text-white'
              }`}
              title="Modo Escuro"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Abas */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 pt-4 transition-colors">
        <nav className="flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('tutoria')}
            className={`pb-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              activeTab === 'tutoria'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            Minha Tutoria ({tutorados.length})
          </button>
          <button
            onClick={() => setActiveTab('disciplinas')}
            className={`pb-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              activeTab === 'disciplinas'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            Disciplinas ({disciplinas.length})
          </button>
          <button
            onClick={() => setActiveTab('professores')}
            className={`pb-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              activeTab === 'professores'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            Professores ({professores.length})
          </button>
          <button
            onClick={() => setActiveTab('matriculas')}
            className={`pb-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              activeTab === 'matriculas'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            Matrículas ({matriculas.length})
          </button>
        </nav>
      </div>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center text-slate-500 dark:text-slate-400 shadow">
            <p className="animate-pulse font-medium">Carregando dados...</p>
          </div>
        )}

        {erro && !loading && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
            {erro}
          </div>
        )}

        {/* VISÃO GERAL */}
        {!loading && activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Painel Geral de Indicadores</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow border-l-4 border-amber-500 border border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Alunos sob Minha Tutoria</p>
                <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{tutorados.length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow border-l-4 border-blue-500 border border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Disciplinas Cadastradas</p>
                <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{disciplinas.length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow border-l-4 border-purple-500 border border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Professores Registrados</p>
                <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{professores.length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow border-l-4 border-green-500 border border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Matrículas Ativas</p>
                <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{matriculas.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* MINHA TUTORIA */}
        {!loading && activeTab === 'tutoria' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Alunos sob Minha Tutoria</h2>

            <form onSubmit={handleColocarSobTutoria} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow space-y-4 border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Adicionar Aluno à Tutoria</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  {alunos.length > 0 ? (
                    <select
                      value={alunoSelecionadoMatricula}
                      onChange={(e) => setAlunoSelecionadoMatricula(e.target.value)}
                      className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                      required
                    >
                      <option value="">Selecione o aluno cadastrado</option>
                      {alunos.map((aluno, idx) => (
                        <option key={idx} value={aluno.matricula}>
                          {aluno.nome} ({aluno.matricula})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Digite a matrícula do aluno (ex: 20260101)"
                      value={alunoSelecionadoMatricula}
                      onChange={(e) => setAlunoSelecionadoMatricula(e.target.value)}
                      className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                      required
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition shadow whitespace-nowrap"
                >
                  Colocar sob minha tutoria
                </button>
              </div>
            </form>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow overflow-hidden border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b dark:border-slate-700">
                  <tr>
                    <th className="p-4">Matrícula</th>
                    <th className="p-4">Nome do Aluno</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {tutorados.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-6 text-center text-slate-400">
                        Você não está tutorando nenhum aluno no momento.
                      </td>
                    </tr>
                  ) : (
                    tutorados.map((item, idx) => {
                      const matricula = item.matricula || item.aluno_matricula || item.aluno?.matricula || '-';
                      const nome = item.nome || item.aluno_nome || item.aluno?.nome || item.aluno?.usuario?.nome || 'Aluno';

                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {matricula}
                          </td>
                          <td className="p-4 font-bold text-slate-800 dark:text-white">
                            {nome}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoverTutoria(matricula)}
                              className="text-red-500 dark:text-red-400 hover:underline text-xs font-semibold"
                            >
                              Remover da tutoria
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DISCIPLINAS */}
        {!loading && activeTab === 'disciplinas' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Gestão de Disciplinas</h2>

            <form onSubmit={handleAddDisciplina} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow space-y-4 border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Cadastrar Nova Disciplina</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nome da Disciplina (ex: Geografia)"
                  value={novaDisciplina.nome}
                  onChange={(e) => setNovaDisciplina({ ...novaDisciplina, nome: e.target.value })}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Código Único (ex: GEO-01)"
                  value={novaDisciplina.codigo}
                  onChange={(e) => setNovaDisciplina({ ...novaDisciplina, codigo: e.target.value })}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
              >
                Salvar Disciplina no Banco
              </button>
            </form>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow overflow-hidden border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b dark:border-slate-700">
                  <tr>
                    <th className="p-4">Código</th>
                    <th className="p-4">Nome da Disciplina</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {disciplinas.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-6 text-center text-slate-400">
                        Nenhuma disciplina cadastrada.
                      </td>
                    </tr>
                  ) : (
                    disciplinas.map((disc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">{disc.codigo}</td>
                        <td className="p-4 font-medium text-slate-800 dark:text-white">{disc.nome}</td>
                        <td className="p-4 text-center space-x-3">
                          <button
                            onClick={() => {
                              setDisciplinaEditando(disc);
                              setNovoNomeDisciplina(disc.nome);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold"
                          >
                            Editar Nome
                          </button>
                          <button
                            onClick={() => handleDeletarDisciplina(disc.codigo)}
                            className="text-red-500 dark:text-red-400 hover:underline text-xs font-semibold"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PROFESSORES */}
        {!loading && activeTab === 'professores' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Corpo Docente Registrado</h2>
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow overflow-hidden border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b dark:border-slate-700">
                  <tr>
                    <th className="p-4">Nome do Docente</th>
                    <th className="p-4">E-mail Institucional</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {professores.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="p-6 text-center text-slate-400">
                        Nenhum professor registrado.
                      </td>
                    </tr>
                  ) : (
                    professores.map((prof, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-4 font-bold text-slate-800 dark:text-white">{prof.nome}</td>
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-400">{prof.email}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MATRÍCULAS */}
        {!loading && activeTab === 'matriculas' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Matrículas e Vínculos Escolares</h2>

            <form onSubmit={handleAddMatricula} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow space-y-4 border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Nova Matrícula</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Matrícula do Aluno</label>
                  <input
                    type="text"
                    placeholder="Ex: 20260101"
                    value={novaMatricula.aluno_matricula}
                    onChange={(e) => setNovaMatricula({ ...novaMatricula, aluno_matricula: e.target.value })}
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Professor Responsável</label>
                  <select
                    value={novaMatricula.professor_email}
                    onChange={(e) => setNovaMatricula({ ...novaMatricula, professor_email: e.target.value })}
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                    required
                  >
                    <option value="">Selecione o professor</option>
                    {professores.map((p, idx) => (
                      <option key={idx} value={p.email}>
                        {p.nome} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Disciplina</label>
                  <select
                    value={novaMatricula.disciplina_codigo}
                    onChange={(e) => setNovaMatricula({ ...novaMatricula, disciplina_codigo: e.target.value })}
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                    required
                  >
                    <option value="">Selecione a disciplina</option>
                    {disciplinas.map((d, idx) => (
                      <option key={idx} value={d.codigo}>
                        {d.codigo} — {d.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="bg-green-600 dark:bg-green-500 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
              >
                Efetivar Matrícula no Banco
              </button>
            </form>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow overflow-hidden border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b dark:border-slate-700">
                  <tr>
                    <th className="p-4">Aluno</th>
                    <th className="p-4">Disciplina</th>
                    <th className="p-4">Professor Responsável</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {matriculas.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-slate-400">
                        Nenhuma matrícula registrada.
                      </td>
                    </tr>
                  ) : (
                    matriculas.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-4">
                          <p className="font-bold text-slate-800 dark:text-white">{m.aluno.nome}</p>
                          <p className="text-xs text-slate-400 font-mono">Matrícula: {m.aluno.matricula}</p>
                        </td>
                        <td className="p-4">
                          <span className="font-mono bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs px-2 py-0.5 rounded font-bold mr-2">
                            {m.disciplina.codigo}
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{m.disciplina.nome}</span>
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-slate-800 dark:text-white">{m.professor.nome}</p>
                          <p className="text-xs text-slate-400">{m.professor.email}</p>
                        </td>
                        <td className="p-4 text-center space-x-3">
                          <button
                            onClick={() => {
                              setMatriculaEditando(m);
                              setNovoProfessorEmail(m.professor.email);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold"
                          >
                            Mudar Professor
                          </button>
                          <button
                            onClick={() => handleDeletarMatricula(m.id)}
                            className="text-red-500 dark:text-red-400 hover:underline text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: EDITAR NOME DE DISCIPLINA */}
      {disciplinaEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Renomear Disciplina</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Código: <strong className="font-mono text-blue-700 dark:text-blue-400">{disciplinaEditando.codigo}</strong>
            </p>

            <form onSubmit={handleEditarNomeDisciplina} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Novo Nome</label>
                <input
                  type="text"
                  required
                  value={novoNomeDisciplina}
                  onChange={(e) => setNovoNomeDisciplina(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDisciplinaEditando(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MUDAR PROFESSOR DA MATRÍCULA */}
      {matriculaEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Alterar Professor Responsável</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Aluno: <strong>{matriculaEditando.aluno.nome}</strong> ({matriculaEditando.disciplina.codigo})
            </p>

            <form onSubmit={handleMudarProfessor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Novo Professor</label>
                <select
                  required
                  value={novoProfessorEmail}
                  onChange={(e) => setNovoProfessorEmail(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 rounded-lg text-sm w-full text-slate-800 dark:text-white focus:outline-blue-500"
                >
                  <option value="">Selecione</option>
                  {professores.map((p, idx) => (
                    <option key={idx} value={p.email}>
                      {p.nome} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setMatriculaEditando(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}