"use client";
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app, db } from '@/app/api/firebase';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import Sidebar from '@/app/components/sidebar';
import Navbar from '@/app/components/navbar';

const SubscriptionsManagementPage = () => {
    const auth = getAuth(app);
    
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        status: 'active',
        startDate: '',
        endDate: '',
        lastPaymentDate: ''
    });
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        expired: 0,
        trial: 0
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchAllOrganizations();
            } else {
                window.location.href = '/';
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchAllOrganizations = async () => {
        try {
            setLoading(true);
            const orgsSnapshot = await getDocs(collection(db, 'organizations'));
            const orgsList = [];

            for (const orgDoc of orgsSnapshot.docs) {
                const orgData = { id: orgDoc.id, ...orgDoc.data() };
                
                // Fetch subscription
                const subDoc = await getDoc(doc(db, `organizations/${orgDoc.id}/subscription/current`));
                if (subDoc.exists()) {
                    orgData.subscription = subDoc.data();
                } else {
                    orgData.subscription = {
                        plan: 'enterprise',
                        status: 'trial',
                        startDate: orgData.createdAt || new Date().toISOString(),
                        endDate: null
                    };
                }

                // Fetch users count
                const usersSnapshot = await getDocs(collection(db, `organizations/${orgDoc.id}/users`));
                orgData.usersCount = usersSnapshot.size;

                // Fetch projects count
                const projectsSnapshot = await getDocs(collection(db, `organizations/${orgDoc.id}/projects`));
                orgData.projectsCount = projectsSnapshot.size;

                orgsList.push(orgData);
            }

            setOrganizations(orgsList);
            calculateStats(orgsList);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching organizations:', error);
            setLoading(false);
        }
    };

    const calculateStats = (orgsList) => {
        const stats = {
            total: orgsList.length,
            active: 0,
            expired: 0,
            trial: 0
        };

        orgsList.forEach(org => {
            const sub = org.subscription;
            if (!sub) {
                stats.trial++;
                return;
            }

            const now = new Date();
            const endDate = sub.endDate ? new Date(sub.endDate) : null;
            const isExpired = endDate && endDate < now;

            if (isExpired) {
                stats.expired++;
            } else if (sub.status === 'active') {
                stats.active++;
            } else if (sub.status === 'trial') {
                stats.trial++;
            }
        });

        setStats(stats);
    };

    const getStatusBadge = (org) => {
        const sub = org.subscription;
        if (!sub) {
            return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Не настроена</span>;
        }

        const now = new Date();
        const endDate = sub.endDate ? new Date(sub.endDate) : null;
        const isExpired = endDate && endDate < now;

        if (isExpired) {
            return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Истекла</span>;
        }

        if (sub.status === 'active') {
            return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Активна</span>;
        }

        if (sub.status === 'trial') {
            return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Пробная</span>;
        }

        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Не активна</span>;
    };

    const getDaysRemaining = (org) => {
        const sub = org.subscription;
        if (!sub || !sub.endDate) return null;
        
        const now = new Date();
        const endDate = new Date(sub.endDate);
        const days = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        return days;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Не указана';
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    const handleEditSubscription = (org) => {
        setSelectedOrg(org);
        const sub = org.subscription || {};
        setEditForm({
            status: sub.status || 'trial',
            startDate: sub.startDate ? new Date(sub.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            endDate: sub.endDate ? new Date(sub.endDate).toISOString().split('T')[0] : '',
            lastPaymentDate: sub.lastPaymentDate ? new Date(sub.lastPaymentDate).toISOString().split('T')[0] : ''
        });
        setShowEditModal(true);
    };

    const handleSaveSubscription = async () => {
        if (!selectedOrg) return;

        try {
            const subscriptionData = {
                plan: 'enterprise',
                status: editForm.status,
                startDate: editForm.startDate ? new Date(editForm.startDate).toISOString() : new Date().toISOString(),
                endDate: editForm.endDate ? new Date(editForm.endDate).toISOString() : null,
                lastPaymentDate: editForm.lastPaymentDate ? new Date(editForm.lastPaymentDate).toISOString() : null,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.uid
            };

            await setDoc(
                doc(db, `organizations/${selectedOrg.id}/subscription/current`),
                subscriptionData,
                { merge: true }
            );

            alert('Подписка успешно обновлена');
            setShowEditModal(false);
            setSelectedOrg(null);
            fetchAllOrganizations();
        } catch (error) {
            console.error('Error updating subscription:', error);
            alert('Ошибка при обновлении подписки');
        }
    };

    const handleQuickActivate = async (org, months) => {
        if (!window.confirm(`Активировать подписку для "${org.name}" на ${months} месяцев?`)) {
            return;
        }

        try {
            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + months);

            const subscriptionData = {
                plan: 'enterprise',
                status: 'active',
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                lastPaymentDate: now.toISOString(),
                updatedAt: now.toISOString(),
                updatedBy: currentUser.uid
            };

            await setDoc(
                doc(db, `organizations/${org.id}/subscription/current`),
                subscriptionData,
                { merge: true }
            );

            alert(`Подписка активирована на ${months} месяцев до ${endDate.toLocaleDateString('ru-RU')}`);
            fetchAllOrganizations();
        } catch (error) {
            console.error('Error activating subscription:', error);
            alert('Ошибка при активации подписки');
        }
    };

    const handleDeactivate = async (org) => {
        if (!window.confirm(`Деактивировать подписку для "${org.name}"?`)) {
            return;
        }

        try {
            await updateDoc(doc(db, `organizations/${org.id}/subscription/current`), {
                status: 'trial',
                endDate: null,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.uid
            });

            alert('Подписка деактивирована');
            fetchAllOrganizations();
        } catch (error) {
            console.error('Error deactivating subscription:', error);
            alert('Ошибка при деактивации подписки');
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-xl">Загрузка...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar />
                
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Управление подписками</h1>
                            <p className="text-gray-600">Администрирование подписок всех организаций</p>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Всего организаций</p>
                                        <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Активные</p>
                                        <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Истекшие</p>
                                        <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Пробные</p>
                                        <p className="text-3xl font-bold text-blue-600">{stats.trial}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Organizations Table */}
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900">Организации и подписки</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Организация
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Статус
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Срок действия
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Пользователи
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Проекты
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Действия
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {organizations.map((org) => {
                                            const daysRemaining = getDaysRemaining(org);
                                            const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;
                                            
                                            return (
                                                <tr key={org.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{org.name}</div>
                                                            <div className="text-sm text-gray-500">{org.shortName}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {getStatusBadge(org)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {org.subscription?.endDate ? formatDate(org.subscription.endDate) : 'Не установлен'}
                                                        </div>
                                                        {daysRemaining !== null && (
                                                            <div className={`text-xs ${isExpiringSoon ? 'text-red-600 font-semibold' : daysRemaining < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                                {daysRemaining < 0 
                                                                    ? `Истекла ${Math.abs(daysRemaining)} дн. назад`
                                                                    : `Осталось ${daysRemaining} дн.`
                                                                }
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {org.usersCount}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {org.projectsCount}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <button
                                                                onClick={() => handleEditSubscription(org)}
                                                                className="text-blue-600 hover:text-blue-900"
                                                                title="Редактировать"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                            </button>
                                                            
                                                            {org.subscription?.status !== 'active' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleQuickActivate(org, 1)}
                                                                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                                                        title="Активировать на 1 месяц"
                                                                    >
                                                                        1м
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleQuickActivate(org, 12)}
                                                                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                                                        title="Активировать на 12 месяцев"
                                                                    >
                                                                        12м
                                                                    </button>
                                                                </>
                                                            )}
                                                            
                                                            {org.subscription?.status === 'active' && (
                                                                <button
                                                                    onClick={() => handleDeactivate(org)}
                                                                    className="text-red-600 hover:text-red-900"
                                                                    title="Деактивировать"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {organizations.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-gray-500">Организации не найдены</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Subscription Modal */}
            {showEditModal && selectedOrg && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full">
                        <div className="p-6 border-b">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold">Редактировать подписку</h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-gray-600 mt-2">{selectedOrg.name}</p>
                        </div>

                        <div className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Статус подписки
                                    </label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="active">Активна</option>
                                        <option value="trial">Пробная</option>
                                        <option value="expired">Истекла</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Дата начала
                                    </label>
                                    <input
                                        type="date"
                                        value={editForm.startDate}
                                        onChange={(e) => setEditForm({...editForm, startDate: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Дата окончания
                                    </label>
                                    <input
                                        type="date"
                                        value={editForm.endDate}
                                        onChange={(e) => setEditForm({...editForm, endDate: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Дата последнего платежа (опционально)
                                    </label>
                                    <input
                                        type="date"
                                        value={editForm.lastPaymentDate}
                                        onChange={(e) => setEditForm({...editForm, lastPaymentDate: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        <strong>Примечание:</strong> Изменения вступят в силу немедленно и будут видны администраторам организации.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t flex justify-end space-x-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSaveSubscription}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionsManagementPage;
