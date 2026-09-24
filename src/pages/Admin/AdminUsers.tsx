import React, { useState } from 'react';
import { Plus, Shield, UserCheck, Trash2, Power, X, Check, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

export const AdminUsers: React.FC = () => {
  const { users, user: currentUser, addUser, updateUser, toggleUserStatus, deleteUser, appSettings } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('castello.2026');
  const [newCategory, setNewCategory] = useState('Sub-16');
  const [newRole, setNewRole] = useState<'admin' | 'seleccionador'>('seleccionador');

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.category_assigned && u.category_assigned.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      showToast('Completa tots els camps obligatoris', 'error');
      return;
    }

    if (users.some((u) => u.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      showToast('Aquest correu ja està registrat', 'error');
      return;
    }

    addUser({
      full_name: newName,
      email: newEmail,
      password: newPassword,
      category_assigned: newCategory,
      role: newRole
    });

    showToast(`Nou ${newRole === 'admin' ? 'administrador' : 'seleccionador'} afegit amb èxit!`, 'success');
    setShowAddModal(false);
    setNewName('');
    setNewEmail('');
    setNewPassword('castello.2026');
  };

  const handleToggleRole = (userId: string, currentRole?: string) => {
    const targetRole = currentRole === 'admin' ? 'seleccionador' : 'admin';
    updateUser(userId, {
      role: {
        id: targetRole === 'admin' ? 'r1' : 'r2',
        name: targetRole,
        description: targetRole === 'admin' ? 'Administrador total' : 'Seleccionador registrat'
      }
    });
    showToast(`Rol canviat a ${targetRole.toUpperCase()}`, 'success');
  };

  const handleDeleteUser = (userId: string, email: string) => {
    if (email === 'seleccio.castello.2026@gmail.com') {
      showToast('No es pot eliminar l’administrador principal del sistema', 'error');
      return;
    }
    if (currentUser?.id === userId) {
      showToast('No et pots eliminar a tu mateix mentres tens la sessió oberta', 'error');
      return;
    }

    if (confirm(`Estàs segur de vulgues eliminar l'usuari ${email}?`)) {
      deleteUser(userId);
      showToast('Usuari eliminat de la plataforma', 'success');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">{t.users}</h1>
          <p className="text-xs font-semibold text-slate-600">
            Control d'accés, permisos i seleccionadors registrats ({users.length})
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Afegir Nou Seleccionador</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-4 bg-white border border-slate-200/90 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cercar per nom, correu o categoría..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden bg-white border border-slate-200/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <th className="p-4">Usuari / Seleccionador</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Últim Accés</th>
                <th className="p-4">Estat</th>
                <th className="p-4 text-right">Accions de Gestió</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    No s'han trobat usuaris registrats.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.role?.name === 'admin';
                  const isMainAdmin = u.email === 'seleccio.castello.2026@gmail.com';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-900 flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full border flex items-center justify-center font-black ${
                            isAdmin
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                              : 'bg-sky-500/10 border-sky-500/30 text-sky-700'
                          }`}
                        >
                          {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#061338]">{u.full_name}</span>
                            {isMainAdmin && (
                              <span className="text-[10px] bg-amber-400/20 text-amber-800 border border-amber-400/40 px-1.5 py-0.5 rounded font-bold">
                                ADMIN PRINCIPAL
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-normal">{u.email}</p>
                        </div>
                      </td>

                      <td className="p-4 font-semibold text-slate-600">
                        {u.category_assigned || 'Totes'}
                      </td>

                      <td className="p-4">
                        <Badge variant={isAdmin ? 'gold' : 'info'}>
                          {isAdmin ? 'ADMINISTRADOR' : 'SELECCIONADOR'}
                        </Badge>
                      </td>

                      <td className="p-4 text-slate-500">{u.last_login || 'Sens dades'}</td>

                      <td className="p-4">
                        <button
                          onClick={() => !isMainAdmin && toggleUserStatus(u.id)}
                          title="Fes clic per canviar l'estat d'activació"
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                            u.is_active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{u.is_active ? 'ACTIU' : 'INACTIU'}</span>
                        </button>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isMainAdmin && (
                            <button
                              onClick={() => handleToggleRole(u.id, u.role?.name)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Canviar entre Admin i Seleccionador"
                            >
                              {isAdmin ? <UserCheck className="w-3.5 h-3.5 text-sky-600" /> : <Shield className="w-3.5 h-3.5 text-amber-600" />}
                              <span>{isAdmin ? 'Fer Seleccionador' : 'Fer Admin'}</span>
                            </button>
                          )}

                          {!isMainAdmin && u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-colors"
                              title="Eliminar Usuari"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Afegir Seleccionador */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Afegir Nou Seleccionador / Usuari
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">
                  Nom Completo
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Mateo Castelló"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">
                  Correu Electrònic
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="seleccionador@selecciocastello.val"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">
                  Contrasenya Inicial
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">
                    Categoría Assignada
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {appSettings.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">
                    Rol d'Accés
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'seleccionador')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="seleccionador">Seleccionador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel·lar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Crear Usuari</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
