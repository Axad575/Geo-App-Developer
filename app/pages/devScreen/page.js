"use client";
import { useState, useEffect } from 'react';
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { app } from '@/app/api/firebase';
import Sidebar from '@/app/components/sidebar';
import Navbar from '@/app/components/navbar';

export default function DevelopersScreen() {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const [developers, setDevelopers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDev, setEditingDev] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'developer',
        specialization: '',
        experience: '',
        skills: '',
        github: '',
        phone: '',
        isActive: true
    });

    // Роли разработчиков
    const developerRoles = [
        { value: 'developer', label: 'Разработчик' },
        { value: 'senior-developer', label: 'Старший разработчик' },
        { value: 'team-lead', label: 'Тимлид' },
        { value: 'architect', label: 'Архитектор' },
        { value: 'devops', label: 'DevOps' },
        { value: 'qa', label: 'QA инженер' },
        { value: 'ui-ux', label: 'UI/UX дизайнер' }
    ];

    // Специализации
    const specializations = [
        'Frontend Developer',
        'Backend Developer',
        'Full Stack Developer',
        'Mobile Developer',
        'DevOps Engineer',
        'Data Scientist',
        'ML Engineer',
        'QA Engineer',
        'UI/UX Designer',
        'Product Manager'
    ];

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchDevelopers();
            }
        });

        return () => unsubscribe();
    }, []);

    // Загрузка разработчиков
    const fetchDevelopers = async () => {
        try {
            setLoading(true);
            const querySnapshot = await getDocs(collection(db, 'developers'));
            const devsList = [];
            querySnapshot.forEach((doc) => {
                devsList.push({ id: doc.id, ...doc.data() });
            });
            setDevelopers(devsList.sort((a, b) => 
                new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            ));
        } catch (error) {
            console.error('Error fetching developers:', error);
            setError('Ошибка загрузки разработчиков');
        } finally {
            setLoading(false);
        }
    };

    // Обработка изменений в форме
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    };

    // Создание разработчика
    const handleCreateDeveloper = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        setSuccess(null);

        try {
            // Создаем пользователя в Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
            const newUser = userCredential.user;

            // Сохраняем данные разработчика в Firestore
            const devData = {
                uid: newUser.uid,
                name: form.name,
                email: form.email,
                role: form.role,
                specialization: form.specialization,
                experience: form.experience,
                skills: form.skills.split(',').map(skill => skill.trim()).filter(skill => skill),
                github: form.github,
                phone: form.phone,
                isActive: form.isActive,
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.uid
            };

            await addDoc(collection(db, 'developers'), devData);

            setSuccess('Разработчик успешно создан!');
            resetForm();
            fetchDevelopers();

            setTimeout(() => setSuccess(null), 3000);
        } catch (error) {
            console.error('Error creating developer:', error);
            setError(error.message || 'Ошибка при создании разработчика');
        } finally {
            setCreating(false);
        }
    };

    // Обновление разработчика
    const handleUpdateDeveloper = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        setSuccess(null);

        try {
            const devDoc = doc(db, 'developers', editingDev.id);
            const updateData = {
                name: form.name,
                role: form.role,
                specialization: form.specialization,
                experience: form.experience,
                skills: form.skills.split(',').map(skill => skill.trim()).filter(skill => skill),
                github: form.github,
                phone: form.phone,
                isActive: form.isActive,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.uid
            };

            await updateDoc(devDoc, updateData);

            setSuccess('Разработчик успешно обновлен!');
            resetForm();
            fetchDevelopers();

            setTimeout(() => setSuccess(null), 3000);
        } catch (error) {
            console.error('Error updating developer:', error);
            setError(error.message || 'Ошибка при обновлении разработчика');
        } finally {
            setCreating(false);
        }
    };

    // Удаление разработчика
    const handleDeleteDeveloper = async (devId) => {
        if (!window.confirm('Вы уверены, что хотите удалить этого разработчика?')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'developers', devId));
            setSuccess('Разработчик успешно удален!');
            fetchDevelopers();

            setTimeout(() => setSuccess(null), 3000);
        } catch (error) {
            console.error('Error deleting developer:', error);
            setError('Ошибка при удалении разработчика');
        }
    };

    // Начало редактирования
    const startEdit = (dev) => {
        setEditingDev(dev);
        setForm({
            name: dev.name || '',
            email: dev.email || '',
            password: '',
            role: dev.role || 'developer',
            specialization: dev.specialization || '',
            experience: dev.experience || '',
            skills: Array.isArray(dev.skills) ? dev.skills.join(', ') : '',
            github: dev.github || '',
            phone: dev.phone || '',
            isActive: dev.isActive !== false
        });
        setIsModalOpen(true);
    };

    // Сброс формы
    const resetForm = () => {
        setForm({
            name: '',
            email: '',
            password: '',
            role: 'developer',
            specialization: '',
            experience: '',
            skills: '',
            github: '',
            phone: '',
            isActive: true
        });
        setEditingDev(null);
        setIsModalOpen(false);
        setError(null);
        setSuccess(null);
    };

    // Форматирование даты
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
                                <h1 className="text-2xl font-bold text-gray-900">Разработчики</h1>
                                <p className="text-gray-600">Управление аккаунтами разработчиков</p>
                            </div>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setIsModalOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                            >
                                + Добавить разработчика
                            </button>
                        </div>
                    </div>

                    {/* Success/Error Messages */}
                    {success && (
                        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="text-green-800">{success}</div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="text-red-800">{error}</div>
                        </div>
                    )}

                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Всего разработчиков</p>
                                    <p className="text-2xl font-bold text-gray-800">{developers.length}</p>
                                </div>
                                <div className="bg-blue-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Активные</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        {developers.filter(dev => dev.isActive !== false).length}
                                    </p>
                                </div>
                                <div className="bg-green-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Тимлиды</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        {developers.filter(dev => dev.role === 'team-lead').length}
                                    </p>
                                </div>
                                <div className="bg-purple-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Сегодня добавлено</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        {developers.filter(dev => {
                                            const today = new Date().toDateString();
                                            const devDate = new Date(dev.createdAt).toDateString();
                                            return today === devDate;
                                        }).length}
                                    </p>
                                </div>
                                <div className="bg-orange-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Developers Table */}
                    <div className="bg-white rounded-lg border">
                        <div className="px-4 py-3 border-b">
                            <h2 className="text-lg font-medium text-gray-900">Список разработчиков</h2>
                        </div>

                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="text-gray-500">Загрузка разработчиков...</div>
                            </div>
                        ) : developers.length === 0 ? (
                            <div className="p-8 text-center">
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Нет разработчиков</h3>
                                <p className="text-gray-500 mb-4">Добавьте первого разработчика в систему</p>
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setIsModalOpen(true);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                                >
                                    Добавить разработчика
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Специализация</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Опыт</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создан</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {developers.map((dev) => (
                                            <tr key={dev.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                                            {(dev.name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {dev.name || 'Без имени'}
                                                            </div>
                                                            {dev.phone && (
                                                                <div className="text-sm text-gray-500">{dev.phone}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{dev.email}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                                                        dev.role === 'team-lead' ? 'bg-purple-100 text-purple-800' :
                                                        dev.role === 'senior-developer' ? 'bg-blue-100 text-blue-800' :
                                                        dev.role === 'architect' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {developerRoles.find(r => r.value === dev.role)?.label || dev.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{dev.specialization || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{dev.experience || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                                                        dev.isActive !== false 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {dev.isActive !== false ? 'Активный' : 'Неактивный'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {formatDate(dev.createdAt)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => startEdit(dev)}
                                                            className="text-blue-600 hover:text-blue-900 text-sm"
                                                        >
                                                            Редактировать
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDeveloper(dev.id)}
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
                    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    {editingDev ? 'Редактировать разработчика' : 'Добавить разработчика'}
                                </h2>
                                <button
                                    onClick={resetForm}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <form onSubmit={editingDev ? handleUpdateDeveloper : handleCreateDeveloper} className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Имя *
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Имя разработчика"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="email@example.com"
                                        required
                                        disabled={editingDev}
                                    />
                                </div>

                                {!editingDev && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Пароль *
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={form.password}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Минимум 6 символов"
                                            minLength="6"
                                            required
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Телефон
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={form.phone}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="+998 90 123 45 67"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Роль
                                    </label>
                                    <select
                                        name="role"
                                        value={form.role}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {developerRoles.map(role => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Специализация
                                    </label>
                                    <select
                                        name="specialization"
                                        value={form.specialization}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Выберите специализацию</option>
                                        {specializations.map(spec => (
                                            <option key={spec} value={spec}>{spec}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Опыт работы
                                    </label>
                                    <input
                                        type="text"
                                        name="experience"
                                        value={form.experience}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Например: 3 года"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        GitHub профиль
                                    </label>
                                    <input
                                        type="url"
                                        name="github"
                                        value={form.github}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://github.com/username"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Навыки
                                </label>
                                <textarea
                                    name="skills"
                                    value={form.skills}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="JavaScript, React, Node.js, Python (через запятую)"
                                    rows="2"
                                />
                            </div>

                            <div>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        checked={form.isActive}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Активный аккаунт</span>
                                </label>
                            </div>

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
                                    {creating ? 'Сохранение...' : (editingDev ? 'Обновить' : 'Создать')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}