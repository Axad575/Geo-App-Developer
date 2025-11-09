"use client";
import { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { app } from '@/app/api/firebase';
import Sidebar from '@/app/components/sidebar';
import Navbar from '@/app/components/navbar';

export default function MapScreen() {
    const auth = getAuth(app);
    const db = getFirestore(app);
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [markers, setMarkers] = useState([]);
    
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState('');
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [userOrgId, setUserOrgId] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    // Загрузка Leaflet CSS и JS
    const loadLeaflet = () => {
        return new Promise((resolve, reject) => {
            if (window.L) {
                resolve();
                return;
            }

            // Загружаем CSS
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const cssLink = document.createElement('link');
                cssLink.rel = 'stylesheet';
                cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
                cssLink.crossOrigin = '';
                document.head.appendChild(cssLink);
            }

            // Загружаем JS
            if (!document.querySelector('script[src*="leaflet.js"]')) {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
                script.crossOrigin = '';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            } else {
                resolve();
            }
        });
    };

    // Инициализация карты
    const initializeMap = async () => {
        try {
            await loadLeaflet();
            
            if (!window.L || !mapRef.current || map) return;

            // Создаем карту
            const mapInstance = window.L.map(mapRef.current, {
                center: [41.2995, 69.2401], // Ташкент
                zoom: 10,
                zoomControl: true
            });

            // Добавляем слой карты
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(mapInstance);

            setMap(mapInstance);
            setMapLoaded(true);
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    };

    // Получение организации пользователя
    const getCurrentUserOrg = async (userId) => {
        try {
            const organizationsSnapshot = await getDocs(collection(db, 'organizations'));
            
            for (const orgDoc of organizationsSnapshot.docs) {
                const userInOrgDoc = await getDoc(doc(db, `organizations/${orgDoc.id}/users/${userId}`));
                if (userInOrgDoc.exists()) {
                    return orgDoc.id;
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching user organization:', error);
            return null;
        }
    };

    // Загрузка организаций
    const fetchOrganizations = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'organizations'));
            const orgsList = [];
            querySnapshot.forEach((doc) => {
                orgsList.push({ id: doc.id, ...doc.data() });
            });
            setOrganizations(orgsList);
        } catch (error) {
            console.error('Error fetching organizations:', error);
        }
    };

    // Загрузка проектов организации
    const fetchOrganizationProjects = async (orgId) => {
        if (!orgId) return;
        
        try {
            const projectsSnapshot = await getDocs(collection(db, `organizations/${orgId}/projects`));
            const projectsList = [];
            
            projectsSnapshot.forEach((doc) => {
                const data = doc.data();
                if (!data.placeholder) { // Исключаем placeholder документы
                    projectsList.push({
                        id: doc.id,
                        ...data
                    });
                }
            });

            setProjects(projectsList);
        } catch (error) {
            console.error('Error fetching projects:', error);
            setProjects([]);
        }
    };

    // Загрузка точек проекта - ИСПРАВЛЕННАЯ ВЕРСИЯ
    const fetchProjectPoints = async (orgId, projectId) => {
        if (!orgId || !projectId) return;
        
        setLoading(true);
        try {
            // Сначала получаем документ проекта
            const projectDoc = await getDoc(doc(db, `organizations/${orgId}/projects/${projectId}`));
            
            if (projectDoc.exists()) {
                const projectData = projectDoc.data();
                
                // Проверяем есть ли массив locations в документе проекта
                if (projectData.locations && Array.isArray(projectData.locations)) {
                    const validPoints = projectData.locations
                        .filter(location => location.latitude && location.longitude)
                        .map(location => ({
                            ...location,
                            lat: parseFloat(location.latitude),
                            lng: parseFloat(location.longitude)
                        }));
                    
                    setPoints(validPoints);
                } else {
                    // Пробуем загрузить из подколлекции locations (если есть)
                    try {
                        const locationsSnapshot = await getDocs(collection(db, `organizations/${orgId}/projects/${projectId}/locations`));
                        const pointsList = [];
                        
                        locationsSnapshot.forEach((doc) => {
                            const data = doc.data();
                            if (data.latitude && data.longitude) {
                                pointsList.push({
                                    id: doc.id,
                                    ...data,
                                    lat: parseFloat(data.latitude),
                                    lng: parseFloat(data.longitude)
                                });
                            }
                        });
                        
                        setPoints(pointsList);
                    } catch (subcollectionError) {
                        console.log('No subcollection found, using empty points');
                        setPoints([]);
                    }
                }
            } else {
                console.error('Project not found');
                setPoints([]);
            }

        } catch (error) {
            console.error('Error fetching points:', error);
            setPoints([]);
        } finally {
            setLoading(false);
        }
    };

    // Создание кастомной иконки
    const createCustomIcon = () => {
        if (!window.L) return null;
        
        return window.L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    background-color: #3B82F6;
                    width: 24px;
                    height: 24px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="
                        width: 8px;
                        height: 8px;
                        background-color: white;
                        border-radius: 50%;
                        transform: rotate(45deg);
                    "></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        });
    };

    // Отображение маркеров на карте
    const displayMarkers = () => {
        if (!map || !window.L) return;

        // Удаляем существующие маркеры
        markers.forEach(marker => map.removeLayer(marker));
        setMarkers([]);

        if (points.length === 0) return;

        const customIcon = createCustomIcon();
        const newMarkers = points.map(point => {
            const marker = window.L.marker([point.lat, point.lng], {
                icon: customIcon
            }).addTo(map);

            // Popup с информацией
            const popupContent = `
                <div style="padding: 10px; max-width: 200px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1f2937;">
                        ${point.name || 'Точка на карте'}
                    </h3>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">
                        ${point.description || 'Без описания'}
                    </p>
                    <div style="font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 6px;">
                        <div style="margin-bottom: 2px;">
                            <strong>Координаты:</strong> ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
                        </div>
                        ${point.createdAt ? `
                            <div>
                                <strong>Создано:</strong> ${new Date(point.createdAt).toLocaleDateString('ru-RU')}
                            </div>
                        ` : ''}
                        ${point.authorName ? `
                            <div>
                                <strong>Автор:</strong> ${point.authorName}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, {
                maxWidth: 250,
                className: 'custom-popup'
            });

            return marker;
        });

        setMarkers(newMarkers);

        // Подгоняем карту под все точки
        if (points.length > 0) {
            const group = new window.L.featureGroup(newMarkers);
            map.fitBounds(group.getBounds(), {
                padding: [20, 20],
                maxZoom: 16
            });
        }
    };

    // Обработка выбора организации
    const handleOrgChange = (orgId) => {
        setSelectedOrg(orgId);
        setSelectedProject('');
        setPoints([]);
        if (orgId) {
            fetchOrganizationProjects(orgId);
        } else {
            setProjects([]);
        }
    };

    // Обработка выбора проекта
    const handleProjectChange = (projectId) => {
        setSelectedProject(projectId);
        if (selectedOrg && projectId) {
            fetchProjectPoints(selectedOrg, projectId);
        } else {
            setPoints([]);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                const orgId = await getCurrentUserOrg(user.uid);
                setUserOrgId(orgId);
                fetchOrganizations();
            }
        });

        initializeMap();

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (mapLoaded && points.length >= 0) {
            displayMarkers();
        }
    }, [mapLoaded, points]);

    // Стили для кастомного popup
    useEffect(() => {
        if (!document.querySelector('#custom-leaflet-styles')) {
            const style = document.createElement('style');
            style.id = 'custom-leaflet-styles';
            style.textContent = `
                .custom-popup .leaflet-popup-content-wrapper {
                    border-radius: 8px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .custom-popup .leaflet-popup-tip {
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .custom-marker {
                    background: transparent !important;
                    border: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    return (
        <div className="flex bg-gray-50 min-h-screen">
            <Sidebar />
            <div className="flex-1">
                <Navbar />
                <div className="p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Карта</h1>
                        <p className="text-gray-600">Просмотр точек на карте по организациям и проектам</p>
                    </div>

                    {/* Controls */}
                    <div className="bg-white rounded-lg border p-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Выберите организацию
                                </label>
                                <select
                                    value={selectedOrg}
                                    onChange={(e) => handleOrgChange(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">— Выберите организацию —</option>
                                    {organizations.map(org => (
                                        <option key={org.id} value={org.id}>
                                            {org.name || org.id}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Выберите проект
                                </label>
                                <select
                                    value={selectedProject}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={!selectedOrg}
                                >
                                    <option value="">— Выберите проект —</option>
                                    {projects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name || project.title || project.id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-4">
                            {loading && (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Загрузка точек...</span>
                                </div>
                            )}
                            {!loading && selectedOrg && selectedProject && (
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                                    Найдено точек: {points.length}
                                </span>
                            )}
                            {selectedOrg && projects.length > 0 && (
                                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                                    Проектов в организации: {projects.length}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Map */}
                    <div className="bg-white rounded-lg border overflow-hidden" style={{ height: '600px' }}>
                        <div 
                            ref={mapRef}
                            style={{ width: '100%', height: '100%' }}
                            className="relative"
                        >
                            {!mapLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-1000">
                                    <div className="text-center">
                                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        <p className="text-gray-600">Загрузка карты...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Points Info */}
                    {selectedOrg && selectedProject && points.length > 0 && (
                        <div className="mt-6 bg-white rounded-lg border">
                            <div className="px-4 py-3 border-b">
                                <h3 className="text-lg font-medium text-gray-900">
                                    Точки проекта ({points.length})
                                </h3>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {points.slice(0, 6).map((point, index) => (
                                        <div key={point.id || index} className="bg-gray-50 rounded-lg p-3 border">
                                            <h4 className="font-medium text-gray-900 mb-1">
                                                {point.name || 'Точка на карте'}
                                            </h4>
                                            <p className="text-sm text-gray-600 mb-2">
                                                {point.description || 'Без описания'}
                                            </p>
                                            <div className="text-xs text-gray-500">
                                                <div>Координаты: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</div>
                                                {point.createdAt && (
                                                    <div>Создано: {new Date(point.createdAt).toLocaleDateString('ru-RU')}</div>
                                                )}
                                                {point.authorName && (
                                                    <div>Автор: {point.authorName}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {points.length > 6 && (
                                    <div className="text-center mt-4">
                                        <p className="text-sm text-gray-500">
                                            И еще {points.length - 6} точек на карте
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* No Data States */}
                    {selectedOrg && !selectedProject && projects.length === 0 && (
                        <div className="mt-6 bg-white rounded-lg border p-8 text-center">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет проектов</h3>
                            <p className="text-gray-500">
                                В выбранной организации пока нет проектов
                            </p>
                        </div>
                    )}

                    {selectedOrg && selectedProject && !loading && points.length === 0 && (
                        <div className="mt-6 bg-white rounded-lg border p-8 text-center">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет точек на карте</h3>
                            <p className="text-gray-500">
                                В выбранном проекте пока нет геоточек для отображения на карте
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}