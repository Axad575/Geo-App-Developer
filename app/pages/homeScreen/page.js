"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app, db } from "@/app/api/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import Sidebar from "@/app/components/sidebar";
import Navbar from "@/app/components/navbar";
import { useStrings } from "@/app/hooks/useStrings";

export default function Home() {
    const auth = getAuth(app);
    const router = useRouter();
    const [organizations, setOrganizations] = useState([]);
    const [allUsers, setAllUsers] = useState([]); // Все пользователи из всех организаций
    const [usersMap, setUsersMap] = useState({}); // Мапа для быстрого поиска
    const [currentUser, setCurrentUser] = useState(null);
    const [developerData, setDeveloperData] = useState(null); // Данные разработчика
    const [orgId, setOrgId] = useState(null);
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(true);
    const [isDeveloper, setIsDeveloper] = useState(false); // Флаг разработчика
    const { t, language } = useStrings();

    // Получаем локаль для форматирования даты в зависимости от языка
    const getLocale = () => {
        switch (language) {
            case 'ru': return 'ru-RU';
            case 'en': return 'en-GB';
            case 'uz': return 'uz-UZ';
            default: return 'en-GB';
        }
    };

    // Проверка, является ли пользователь разработчиком через коллекцию developers
    const checkIfDeveloper = async (userUid, userEmail) => {
        try {
            console.log('Checking developer status for:', userUid, userEmail);
            
            // Проверяем по UID
            const developerDocByUid = await getDoc(doc(db, 'developers', userUid));
            if (developerDocByUid.exists()) {
                const data = developerDocByUid.data();
                console.log('Developer found by UID:', data);
                setDeveloperData({
                    id: userUid,
                    ...data
                });
                return true;
            }

            // Проверяем по email в коллекции
            const developersSnapshot = await getDocs(collection(db, 'developers'));
            for (const devDoc of developersSnapshot.docs) {
                const devData = devDoc.data();
                if (devData.email?.toLowerCase() === userEmail?.toLowerCase()) {
                    console.log('Developer found by email:', devData);
                    setDeveloperData({
                        id: devDoc.id,
                        ...devData
                    });
                    return true;
                }
            }

            console.log('User is not a developer');
            return false;
        } catch (error) {
            console.error('Error checking developer status:', error);
            return false;
        }
    };

    // Получение текущей организации пользователя
    const getCurrentUserOrg = async (userId) => {
        try {
            // Ищем пользователя в подколлекциях organizations/{orgId}/users
            const organizationsSnapshot = await getDocs(collection(db, 'organizations'));
            
            for (const orgDoc of organizationsSnapshot.docs) {
                const userInOrgDoc = await getDoc(doc(db, `organizations/${orgDoc.id}/users/${userId}`));
                if (userInOrgDoc.exists()) {
                    console.log('User found in organization:', orgDoc.id, orgDoc.data().name);
                    return orgDoc.id;
                }
            }

            console.log('User not found in any organization');
            return null;
        } catch (error) {
            console.error('Error fetching user organization:', error);
            return null;
        }
    };

    // Получение данных организации
    const fetchOrganizationData = async (organizationId) => {
        try {
            const orgDoc = await getDoc(doc(db, `organizations/${organizationId}`));
            if (orgDoc.exists()) {
                setOrgName(orgDoc.data().name || 'Organization');
            }
        } catch (error) {
            console.error('Error fetching organization data:', error);
        }
    };

    // Получение всех организаций
    const fetchOrganizations = async () => {
        try {
            const organizationsSnapshot = await getDocs(collection(db, 'organizations'));
            const orgsList = [];
            organizationsSnapshot.forEach(doc => {
                orgsList.push({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt || new Date().toISOString()
                });
            });
            setOrganizations(orgsList);
            return orgsList;
        } catch (error) {
            console.error('Error fetching organizations:', error);
            return [];
        }
    };

    // Получение всех пользователей из всех организаций
    const fetchAllUsers = async () => {
        try {
            const organizationsSnapshot = await getDocs(collection(db, 'organizations'));
            const allUsersList = [];
            const usersMapTemp = {};
            
            for (const orgDoc of organizationsSnapshot.docs) {
                const orgData = orgDoc.data();
                const usersRef = collection(db, `organizations/${orgDoc.id}/users`);
                const usersSnapshot = await getDocs(usersRef);
                
                usersSnapshot.forEach(userDoc => {
                    const userData = {
                        id: userDoc.id,
                        ...userDoc.data(),
                        organizationId: orgDoc.id,
                        organizationName: orgData.name || orgDoc.id,
                        joinedAt: userDoc.data().joinedAt || new Date().toISOString()
                    };
                    allUsersList.push(userData);
                    usersMapTemp[userDoc.id] = userData.name || userData.email;
                });
            }
            
            setAllUsers(allUsersList);
            setUsersMap(usersMapTemp);
            return { usersList: allUsersList, usersMap: usersMapTemp };
        } catch (error) {
            console.error('Error fetching all users:', error);
            return { usersList: [], usersMap: {} };
        }
    };

    // Получение данных
    const fetchData = async (organizationId, userId) => {
        try {
            await fetchOrganizations();
            await fetchAllUsers();
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                
                // Проверяем, является ли пользователь разработчиком
                const isDevUser = await checkIfDeveloper(user.uid, user.email);
                setIsDeveloper(isDevUser);
                
                if (isDevUser) {
                    // Разработчик может работать без организации
                    console.log('Developer access granted');
                    setOrgName('Developer Mode');
                    await fetchData(null, user.uid);
                } else {
                    // Обычный пользователь должен быть в организации
                    const userOrgId = await getCurrentUserOrg(user.uid);
                    
                    if (userOrgId) {
                        setOrgId(userOrgId);
                        await fetchOrganizationData(userOrgId);
                        await fetchData(userOrgId, user.uid);
                    } else {
                        console.error('User is not assigned to any organization');
                        setLoading(false);
                        alert('You are not assigned to any organization. Please contact your administrator.');
                    }
                }
            } else {
                router.push('/auth/login');
            }
        });

        return () => unsubscribe();
    }, []);

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString(getLocale(), {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const today = new Date().toLocaleDateString(getLocale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        weekday: 'long'
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    // Если пользователь не привязан к организации и не разработчик
    if (!orgId && !isDeveloper) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                    <svg className="w-16 h-16 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">No Organization</h2>
                    <p className="text-gray-600 mb-6">
                        You are not assigned to any organization. Please contact your administrator to get access.
                    </p>
                    <button
                        onClick={() => auth.signOut()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex">
            <Sidebar orgId={orgId} />
            <div className="flex-1">
                <Navbar orgId={orgId} />
                <div className="p-6 bg-gray-50 min-h-screen">
                    {/* Welcome Section */}
                    <div className={`rounded-lg p-6 mb-6 text-white ${isDeveloper ? 'bg-purple-600' : 'bg-blue-600'}`}>
                        <h1 className="text-2xl font-bold mb-2">
                            {t('home.title')}, {usersMap[currentUser?.uid] || developerData?.name || currentUser?.displayName || 'User'}!
                            {isDeveloper && (
                                <span className="ml-2 text-sm bg-white bg-opacity-20 px-2 py-1 rounded">
                                    Developer
                                </span>
                            )}
                        </h1>
                        <div className="flex items-center gap-2 text-blue-100 mb-3">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isDeveloper ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                )}
                            </svg>
                            <p className="text-lg font-medium">
                                {isDeveloper ? 
                                    `Developer Mode - ${developerData?.description || 'Full system access'}` : 
                                    orgName
                                }
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-blue-200">{t('home.today')}</p>
                            <p className="text-lg font-semibold">{today}</p>
                        </div>
                    </div>

                    {/* Developer Notice */}
                    {isDeveloper && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                            <div className="flex">
                                <svg className="w-5 h-5 text-purple-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h3 className="text-sm font-medium text-purple-800">
                                        Режим разработчика
                                    </h3>
                                    <p className="text-sm text-purple-700 mt-1">
                                        {developerData?.description || 'Вы работаете в режиме разработчика и имеете доступ ко всем данным системы.'}
                                    </p>
                                    {developerData?.permissions && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-600">
                                                Разрешения: {developerData.permissions.join(', ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                                    <p className="text-sm text-gray-600">Всего пользователей</p>
                                    <p className="text-2xl font-bold text-gray-800">{allUsers.length}</p>
                                </div>
                                <div className="bg-green-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Администраторы</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        {allUsers.filter(user => user.role === 'admin').length}
                                    </p>
                                </div>
                                <div className="bg-red-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Активные пользователи</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        {allUsers.filter(user => user.isActive !== false).length}
                                    </p>
                                </div>
                                <div className="bg-purple-100 rounded-full p-3">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Organizations Section */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">
                                Организации
                                {isDeveloper && (
                                    <span className="ml-2 text-sm text-purple-600">
                                        (Все доступные)
                                    </span>
                                )}
                            </h2>
                            <a href="/pages/organizationsScreen" className="text-blue-600 hover:text-blue-800 text-sm">
                                Просмотреть все
                            </a>
                        </div>
                        
                        {organizations.length === 0 ? (
                            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <p className="text-gray-500 mb-2">Нет организаций</p>
                                <p className="text-sm text-gray-400">Создайте первую организацию</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <div className="flex gap-4 pb-4">
                                    {organizations.slice(0, 6).map((org) => (
                                        <div key={org.id} className="flex shrink-0 w-80">
                                            <div className="bg-white rounded-lg border p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="bg-blue-100 rounded-full p-2">
                                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {formatDate(org.createdAt)}
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                                    {org.name || 'Без названия'}
                                                </h3>
                                                <p className="text-sm text-gray-600 mb-3">
                                                    {org.description ? 
                                                        (org.description.length > 100 ? 
                                                            `${org.description.substring(0, 100)}...` : 
                                                            org.description
                                                        ) : 
                                                        'Описание отсутствует'
                                                    }
                                                </p>
                                                <div className="flex items-center justify-between text-sm text-gray-500">
                                                    <span>Пользователей: {allUsers.filter(user => user.organizationId === org.id).length}</span>
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        org.id === orgId ? 'bg-green-100 text-green-800' : 
                                                        isDeveloper ? 'bg-purple-100 text-purple-800' : 
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {org.id === orgId ? 'Текущая' : 
                                                         isDeveloper ? 'Доступна' : 
                                                         'Другая'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* All Users Section */}
                    <div className="bg-green-50 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">
                                Все пользователи системы
                                {isDeveloper && (
                                    <span className="ml-2 text-sm text-purple-600">
                                        (Полный доступ)
                                    </span>
                                )}
                            </h2>
                            <a href="/pages/usersScreen" className="text-blue-600 hover:text-blue-800 text-sm">
                                Управление пользователями
                            </a>
                        </div>
                        
                        {allUsers.length === 0 ? (
                            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="text-gray-500 mb-2">Нет пользователей</p>
                                <p className="text-sm text-gray-400">Добавьте первого пользователя в организацию</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <div className="flex gap-4 pb-4">
                                    {allUsers.slice(0, 12).map((user) => (
                                        <div key={`${user.organizationId}-${user.id}`} className="flex shrink-0 w-72">
                                            <div className="bg-white rounded-lg border p-4">
                                                <div className="flex items-center mb-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                                                        user.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'
                                                    }`}>
                                                        {(user.name || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="ml-3">
                                                        <h3 className="text-sm font-medium text-gray-900">
                                                            {user.name || 'Без имени'}
                                                            {currentUser && currentUser.uid === user.uid && (
                                                                <span className="ml-1 text-xs text-blue-600">(Вы)</span>
                                                            )}
                                                        </h3>
                                                        <p className="text-xs text-gray-500">{user.email}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="mb-2">
                                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                        {user.organizationName}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                                                        user.role === 'admin' 
                                                            ? 'bg-red-100 text-red-800' 
                                                            : user.role === 'manager'
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-green-100 text-green-800'
                                                    }`}>
                                                        {user.role || 'user'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {formatDate(user.joinedAt)}
                                                    </span>
                                                </div>
                                                {user.phone && (
                                                    <div className="mt-2 text-xs text-gray-600">
                                                        📞 {user.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {allUsers.length > 12 && (
                                    <div className="text-center mt-4">
                                        <p className="text-sm text-gray-500">
                                            Показано 12 из {allUsers.length} пользователей
                                        </p>
                                        <a href="/pages/usersScreen" className="text-blue-600 hover:text-blue-800 text-sm">
                                            Просмотреть всех пользователей →
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
