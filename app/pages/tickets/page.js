"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app, db } from "@/app/api/firebase";
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";
import Sidebar from "@/app/components/sidebar";
import Navbar from "@/app/components/navbar";
import { useStrings } from "@/app/hooks/useStrings";

export default function DeveloperTickets() {
    const auth = getAuth(app);
    const router = useRouter();
    const { t, language } = useStrings();
    
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [organizations, setOrganizations] = useState({});
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [response, setResponse] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const getLocale = () => {
        switch (language) {
            case 'ru': return 'ru-RU';
            case 'en': return 'en-GB';
            case 'uz': return 'uz-UZ';
            default: return 'en-GB';
        }
    };

    // Загрузка всех тикетов из всех организаций
    const fetchAllTickets = async () => {
        try {
            const organizationsSnapshot = await getDocs(collection(db, 'organizations'));
            const orgsMap = {};
            const allTickets = [];

            for (const orgDoc of organizationsSnapshot.docs) {
                orgsMap[orgDoc.id] = orgDoc.data().name;
                
                const ticketsRef = collection(db, `organizations/${orgDoc.id}/tickets`);
                const ticketsSnapshot = await getDocs(query(ticketsRef, orderBy('createdAt', 'desc')));
                
                ticketsSnapshot.docs.forEach(ticketDoc => {
                    allTickets.push({
                        id: ticketDoc.id,
                        orgId: orgDoc.id,
                        orgName: orgDoc.data().name,
                        ...ticketDoc.data()
                    });
                });
            }

            setOrganizations(orgsMap);
            setTickets(allTickets);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                await fetchAllTickets();
            } else {
                router.push('/auth/login');
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleUpdateStatus = async (ticketId, orgId, newStatus) => {
        setUpdatingStatus(true);
        try {
            await updateDoc(doc(db, `organizations/${orgId}/tickets/${ticketId}`), {
                status: newStatus,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.uid
            });

            await fetchAllTickets();
            alert(t('developerTickets.statusUpdated'));
        } catch (error) {
            console.error('Error updating status:', error);
            alert(t('developerTickets.updateError'));
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleAddResponse = async () => {
        if (!response.trim()) {
            alert(t('developerTickets.enterResponse'));
            return;
        }

        setUpdatingStatus(true);
        try {
            const ticketRef = doc(db, `organizations/${selectedTicket.orgId}/tickets/${selectedTicket.id}`);
            const ticketDoc = await getDoc(ticketRef);
            const currentResponses = ticketDoc.data().responses || [];

            await updateDoc(ticketRef, {
                responses: [
                    ...currentResponses,
                    {
                        text: response,
                        author: currentUser.email,
                        authorId: currentUser.uid,
                        createdAt: new Date().toISOString()
                    }
                ],
                updatedAt: new Date().toISOString()
            });

            setResponse('');
            await fetchAllTickets();
            
            // Обновляем выбранный тикет
            const updatedTicket = tickets.find(t => t.id === selectedTicket.id && t.orgId === selectedTicket.orgId);
            if (updatedTicket) {
                setSelectedTicket(updatedTicket);
            }
            
            alert(t('developerTickets.responseAdded'));
        } catch (error) {
            console.error('Error adding response:', error);
            alert(t('developerTickets.responseError'));
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleDeleteTicket = async (ticketId, orgId) => {
        if (!confirm(t('developerTickets.confirmDelete'))) return;

        try {
            await deleteDoc(doc(db, `organizations/${orgId}/tickets/${ticketId}`));
            await fetchAllTickets();
            setShowDetailModal(false);
            alert(t('developerTickets.ticketDeleted'));
        } catch (error) {
            console.error('Error deleting ticket:', error);
            alert(t('developerTickets.deleteError'));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleDateString(getLocale(), {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    };

    const getStatusBadge = (status) => {
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
            resolved: 'bg-green-100 text-green-800 border-green-300',
            rejected: 'bg-red-100 text-red-800 border-red-300'
        };
        
        const statusTexts = {
            pending: t('tickets.pending'),
            in_progress: t('tickets.inProgress'),
            resolved: t('tickets.resolved'),
            rejected: t('tickets.rejected')
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status] || statusColors.pending}`}>
                {statusTexts[status] || status}
            </span>
        );
    };

    const getTypeBadge = (type) => {
        const typeColors = {
            suggestion: 'bg-purple-100 text-purple-800',
            bug: 'bg-red-100 text-red-800',
            feature: 'bg-blue-100 text-blue-800',
            question: 'bg-gray-100 text-gray-800',
            other: 'bg-gray-100 text-gray-800'
        };
        
        const typeTexts = {
            suggestion: t('tickets.suggestion'),
            bug: t('tickets.bug'),
            feature: t('tickets.feature'),
            question: t('tickets.question'),
            other: t('tickets.other')
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${typeColors[type] || typeColors.other}`}>
                {typeTexts[type] || type}
            </span>
        );
    };

    const getPriorityBadge = (priority) => {
        const priorityColors = {
            low: 'bg-green-100 text-green-800',
            medium: 'bg-yellow-100 text-yellow-800',
            high: 'bg-orange-100 text-orange-800',
            critical: 'bg-red-100 text-red-800'
        };
        
        const priorityTexts = {
            low: t('tickets.lowPriority'),
            medium: t('tickets.mediumPriority'),
            high: t('tickets.highPriority'),
            critical: t('tickets.criticalPriority')
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${priorityColors[priority] || priorityColors.medium}`}>
                {priorityTexts[priority] || priority}
            </span>
        );
    };

    // Фильтрация и поиск
    const filteredTickets = tickets.filter(ticket => {
        const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
        const matchesType = filterType === 'all' || ticket.type === filterType;
        const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority;
        const matchesSearch = searchQuery === '' || 
            ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.orgName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.userName?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesStatus && matchesType && matchesPriority && matchesSearch;
    });

    // Статистика
    const stats = {
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        rejected: tickets.filter(t => t.status === 'rejected').length,
        critical: tickets.filter(t => t.priority === 'critical').length,
        bugs: tickets.filter(t => t.type === 'bug').length
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">{t('loading')}...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Navbar />
                <main className="flex-1 p-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900">{t('developerTickets.title')}</h1>
                            <p className="text-gray-600 mt-1">{t('developerTickets.subtitle')}</p>
                        </div>

                        {/* Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                            <div className="bg-white rounded-lg shadow p-4">
                                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                                <div className="text-sm text-gray-600">{t('developerTickets.total')}</div>
                            </div>
                            <div className="bg-yellow-50 rounded-lg shadow p-4 border border-yellow-200">
                                <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
                                <div className="text-sm text-yellow-600">{t('tickets.pending')}</div>
                            </div>
                            <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
                                <div className="text-2xl font-bold text-blue-800">{stats.inProgress}</div>
                                <div className="text-sm text-blue-600">{t('tickets.inProgress')}</div>
                            </div>
                            <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
                                <div className="text-2xl font-bold text-green-800">{stats.resolved}</div>
                                <div className="text-sm text-green-600">{t('tickets.resolved')}</div>
                            </div>
                            <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
                                <div className="text-2xl font-bold text-red-800">{stats.rejected}</div>
                                <div className="text-sm text-red-600">{t('tickets.rejected')}</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg shadow p-4 border border-orange-200">
                                <div className="text-2xl font-bold text-orange-800">{stats.critical}</div>
                                <div className="text-sm text-orange-600">{t('developerTickets.critical')}</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg shadow p-4 border border-purple-200">
                                <div className="text-2xl font-bold text-purple-800">{stats.bugs}</div>
                                <div className="text-sm text-purple-600">{t('tickets.bug')}</div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-lg shadow p-4 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Search */}
                                <div>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t('developerTickets.search')}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Status Filter */}
                                <div>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">{t('developerTickets.allStatuses')}</option>
                                        <option value="pending">{t('tickets.pending')}</option>
                                        <option value="in_progress">{t('tickets.inProgress')}</option>
                                        <option value="resolved">{t('tickets.resolved')}</option>
                                        <option value="rejected">{t('tickets.rejected')}</option>
                                    </select>
                                </div>

                                {/* Type Filter */}
                                <div>
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">{t('developerTickets.allTypes')}</option>
                                        <option value="suggestion">{t('tickets.suggestion')}</option>
                                        <option value="bug">{t('tickets.bug')}</option>
                                        <option value="feature">{t('tickets.feature')}</option>
                                        <option value="question">{t('tickets.question')}</option>
                                        <option value="other">{t('tickets.other')}</option>
                                    </select>
                                </div>

                                {/* Priority Filter */}
                                <div>
                                    <select
                                        value={filterPriority}
                                        onChange={(e) => setFilterPriority(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">{t('developerTickets.allPriorities')}</option>
                                        <option value="critical">{t('tickets.criticalPriority')}</option>
                                        <option value="high">{t('tickets.highPriority')}</option>
                                        <option value="medium">{t('tickets.mediumPriority')}</option>
                                        <option value="low">{t('tickets.lowPriority')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Tickets List */}
                        <div className="space-y-4">
                            {filteredTickets.length === 0 ? (
                                <div className="bg-white rounded-lg shadow p-12 text-center">
                                    <div className="text-6xl mb-4">📋</div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                        {t('developerTickets.noTicketsFound')}
                                    </h3>
                                </div>
                            ) : (
                                filteredTickets.map(ticket => (
                                    <div 
                                        key={`${ticket.orgId}-${ticket.id}`} 
                                        className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 cursor-pointer"
                                        onClick={() => {
                                            setSelectedTicket(ticket);
                                            setShowDetailModal(true);
                                        }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {ticket.title}
                                                    </h3>
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                                        {ticket.orgName}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mb-3">
                                                    {getTypeBadge(ticket.type)}
                                                    {getPriorityBadge(ticket.priority)}
                                                    {getStatusBadge(ticket.status)}
                                                </div>

                                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                                                    {ticket.description}
                                                </p>

                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        {ticket.userName}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        {formatDate(ticket.createdAt)}
                                                    </span>
                                                    {ticket.responses && ticket.responses.length > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                            </svg>
                                                            {ticket.responses.length}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="flex gap-2 ml-4">
                                                {ticket.status === 'pending' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpdateStatus(ticket.id, ticket.orgId, 'in_progress');
                                                        }}
                                                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                                        disabled={updatingStatus}
                                                    >
                                                        {t('developerTickets.startWork')}
                                                    </button>
                                                )}
                                                {ticket.status === 'in_progress' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpdateStatus(ticket.id, ticket.orgId, 'resolved');
                                                        }}
                                                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                                        disabled={updatingStatus}
                                                    >
                                                        {t('developerTickets.markResolved')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedTicket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="border-b p-6">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        {selectedTicket.title}
                                    </h2>
                                    <div className="flex items-center gap-2 mb-3">
                                        {getTypeBadge(selectedTicket.type)}
                                        {getPriorityBadge(selectedTicket.priority)}
                                        {getStatusBadge(selectedTicket.status)}
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                            {selectedTicket.orgName}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Description */}
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('tickets.description')}</h3>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.description}</p>
                                </div>
                            </div>

                            {/* User Info */}
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('developerTickets.userInfo')}</h3>
                                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-600">{t('developerTickets.name')}:</span>
                                        <span className="font-medium">{selectedTicket.userName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-600">{t('developerTickets.email')}:</span>
                                        <span className="font-medium">{selectedTicket.userEmail}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-600">{t('developerTickets.organization')}:</span>
                                        <span className="font-medium">{selectedTicket.orgName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-600">{t('developerTickets.created')}:</span>
                                        <span className="font-medium">{formatDate(selectedTicket.createdAt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Responses */}
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                    {t('developerTickets.responses')} ({selectedTicket.responses?.length || 0})
                                </h3>
                                <div className="space-y-3">
                                    {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                                        selectedTicket.responses.map((resp, index) => (
                                            <div key={index} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-medium text-blue-900">{resp.author}</span>
                                                    <span className="text-xs text-blue-600">
                                                        {formatDate(resp.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{resp.text}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center py-4">
                                            {t('developerTickets.noResponses')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Add Response */}
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('developerTickets.addResponse')}</h3>
                                <textarea
                                    value={response}
                                    onChange={(e) => setResponse(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                                    placeholder={t('developerTickets.responsePlaceholder')}
                                    disabled={updatingStatus}
                                />
                                <button
                                    onClick={handleAddResponse}
                                    disabled={!response.trim() || updatingStatus}
                                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updatingStatus ? t('developerTickets.adding') : t('developerTickets.addResponseBtn')}
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t p-6">
                            <div className="flex gap-3 justify-between">
                                <button
                                    onClick={() => handleDeleteTicket(selectedTicket.id, selectedTicket.orgId)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    {t('developerTickets.delete')}
                                </button>
                                <div className="flex gap-3">
                                    {selectedTicket.status !== 'rejected' && (
                                        <button
                                            onClick={() => handleUpdateStatus(selectedTicket.id, selectedTicket.orgId, 'rejected')}
                                            disabled={updatingStatus}
                                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                                        >
                                            {t('developerTickets.reject')}
                                        </button>
                                    )}
                                    {selectedTicket.status === 'pending' && (
                                        <button
                                            onClick={() => handleUpdateStatus(selectedTicket.id, selectedTicket.orgId, 'in_progress')}
                                            disabled={updatingStatus}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {t('developerTickets.startWork')}
                                        </button>
                                    )}
                                    {selectedTicket.status === 'in_progress' && (
                                        <button
                                            onClick={() => handleUpdateStatus(selectedTicket.id, selectedTicket.orgId, 'resolved')}
                                            disabled={updatingStatus}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {t('developerTickets.markResolved')}
                                        </button>
                                    )}
                                    {selectedTicket.status === 'resolved' && (
                                        <button
                                            onClick={() => handleUpdateStatus(selectedTicket.id, selectedTicket.orgId, 'in_progress')}
                                            disabled={updatingStatus}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {t('developerTickets.reopenTicket')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}