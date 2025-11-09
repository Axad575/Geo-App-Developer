"use client";
import { useState, useEffect } from 'react';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/app/api/firebase';
import Sidebar from '@/app/components/sidebar';
import Navbar from '@/app/components/navbar';

export default function OrganizationsPage() {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ 
        name: '', 
        shortName: '', 
        description: '', 
        domain: '', 
        initUsers: false, 
        initProjects: false, 
        initMeetings: false 
    });
    const [creating, setCreating] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchOrganizations();
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchOrganizations = async () => {
        try {
            setLoading(true);
            const querySnapshot = await getDocs(collection(db, 'organizations'));
            const orgsList = [];
            querySnapshot.forEach((doc) => {
                orgsList.push({ id: doc.id, ...doc.data() });
            });
            setOrganizations(orgsList.sort((a, b) => 
                new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            ));
        } catch (error) {
            console.error('Error fetching organizations:', error);
            setError('Ошибка загрузки организаций');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        try {
            const orgData = {
                name: form.name,
                shortName: form.shortName,
                description: form.description || '',
                domain: form.domain || '',
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.uid
            };

            const orgRef = await addDoc(collection(db, 'organizations'), orgData);

            // Initialize subcollections with placeholder documents
            if (form.initUsers) {
                await addDoc(collection(db, `organizations/${orgRef.id}/users`), {
                    placeholder: true,
                    createdAt: new Date().toISOString()
                });
            }
            if (form.initProjects) {
                await addDoc(collection(db, `organizations/${orgRef.id}/projects`), {
                    placeholder: true,
                    createdAt: new Date().toISOString()
                });
            }
            if (form.initMeetings) {
                await addDoc(collection(db, `organizations/${orgRef.id}/meetings`), {
                    placeholder: true,
                    createdAt: new Date().toISOString()
                });
            }

            resetForm();
            fetchOrganizations();
            alert('Организация успешно создана!');
        } catch (err) {
            console.error('Error creating organization:', err);
            setError(err.message || String(err));
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateOrg = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        try {
            const orgDoc = doc(db, 'organizations', editingOrg.id);
            await updateDoc(orgDoc, {
                name: form.name,
                shortName: form.shortName,
                description: form.description || '',
                domain: form.domain || '',
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.uid
            });

            resetForm();
            fetchOrganizations();
            alert('Организация успешно обновлена!');
        } catch (err) {
            console.error('Error updating organization:', err);
            setError(err.message || String(err));
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteOrg = async (orgId) => {
        if (!window.confirm('Вы уверены, что хотите удалить эту организацию? Это действие необратимо.')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'organizations', orgId));
            fetchOrganizations();
            alert('Организация успешно удалена!');
        } catch (error) {
            console.error('Error deleting organization:', error);
            alert(`Ошибка удаления организации: ${error.message}`);
        }
    };

    const startEdit = (org) => {
        setEditingOrg(org);
        setForm({
            name: org.name || '',
            shortName: org.shortName || '',
            description: org.description || '',
            domain: org.domain || '',
            initUsers: false,
            initProjects: false,
            initMeetings: false
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setForm({ 
            name: '', 
            shortName: '', 
            description: '', 
            domain: '', 
            initUsers: false, 
            initProjects: false, 
            initMeetings: false 
        });
        setEditingOrg(null);
        setIsModalOpen(false);
        setError(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex bg-gray-50 min-h-screen">
            <Sidebar />
            <div className="flex-1">
                <Navbar />
                <div className="p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Управление организациями</h1>
                                <p className="text-gray-600">Создание и управление организациями системы</p>
                            </div>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setIsModalOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                            >
                                + Создать организацию
                            </button>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Всего организаций</p>
                                    <p className="text-2xl font-bold text-gray-800">{organizations.length}</p>
                                </div>
                                <div className="bg-blue-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Созданных сегодня</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        {organizations.filter(org => {
                                            const today = new Date().toDateString();
                                            const orgDate = new Date(org.createdAt).toDateString();
                                            return today === orgDate;
                                        }).length}
                                    </p>
                                </div>
                                <div className="bg-green-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Последняя создана</p>
                                    <p className="text-sm font-medium text-gray-800">
                                        {organizations.length > 0 ? formatDate(organizations[0]?.createdAt) : '—'}
                                    </p>
                                </div>
                                <div className="bg-purple-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Organizations List */}
                    <div className="bg-white rounded-lg border">
                        <div className="px-4 py-3 border-b">
                            <h2 className="text-lg font-medium text-gray-900">Список организаций</h2>
                        </div>

                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="text-gray-500">Загрузка организаций...</div>
                            </div>
                        ) : organizations.length === 0 ? (
                            <div className="p-8 text-center">
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Нет организаций</h3>
                                <p className="text-gray-500 mb-4">Создайте первую организацию для начала работы</p>
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setIsModalOpen(true);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                                >
                                    Создать организацию
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Короткое название</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Домен</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создана</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {organizations.map((org) => (
                                            <tr key={org.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {org.name || 'Без названия'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {org.description ? 
                                                                (org.description.length > 50 ? 
                                                                    `${org.description.substring(0, 50)}...` : 
                                                                    org.description
                                                                ) : 
                                                                'Без описания'
                                                            }
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {org.shortName || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {org.domain || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {formatDate(org.createdAt)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                        {org.id}
                                                    </code>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => startEdit(org)}
                                                            className="text-blue-600 hover:text-blue-900 text-sm"
                                                        >
                                                            Редактировать
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteOrg(org.id)}
                                                            className="text-red-600 hover:text-red-900 text-sm"
                                                        >
                                                            Удалить
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    {editingOrg ? 'Редактировать организацию' : 'Создать организацию'}
                                </h2>
                                <button
                                    onClick={resetForm}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <form onSubmit={editingOrg ? handleUpdateOrg : handleCreateOrg} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Название организации *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Введите название организации"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Короткое название *
                                </label>
                                <input
                                    type="text"
                                    name="shortName"
                                    value={form.shortName}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Краткое название"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Домен
                                </label>
                                <input
                                    type="text"
                                    name="domain"
                                    value={form.domain}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Описание
                                </label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Описание организации"
                                    rows="3"
                                />
                            </div>

                            {!editingOrg && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Инициализировать коллекции
                                    </label>
                                    <div className="space-y-2">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                name="initUsers"
                                                checked={form.initUsers}
                                                onChange={handleChange}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Пользователи</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                name="initProjects"
                                                checked={form.initProjects}
                                                onChange={handleChange}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Проекты</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                name="initMeetings"
                                                checked={form.initMeetings}
                                                onChange={handleChange}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Встречи</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="text-red-800 text-sm">{error}</div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                                >
                                    {creating ? 'Сохранение...' : (editingOrg ? 'Обновить' : 'Создать')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

