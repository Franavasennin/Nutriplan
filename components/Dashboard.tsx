import React, { useState } from 'react';
import { SavedDiet, DIET_TYPE_LABELS, PatientData, Gender, ActivityLevel, Condition } from '../types';

interface Props {
    stats: {
        totalClients: number;
        activePlans: number;
        customFoods: number;
    };
    allDiets: SavedDiet[];          // lista completa — se deduplica aquí para mostrar 1 tarjeta por cliente
    onNewClient: () => void;
    onLoadDiet: (diet: SavedDiet) => void;
    onDeleteDiet: (id: string) => void;
    onEditClient: (diet: SavedDiet) => void;
    onUpdatePatientData: (id: string, data: Partial<PatientData>) => void;
    installEvent: any;
    onInstall: () => void;
    onExportCSV: () => void;
    onAddPartner: (diet: SavedDiet) => void;
    onOpenPortalLink: (diet: SavedDiet) => void;
}

type Filter = 'all' | 'active' | 'inactive';

const Dashboard: React.FC<Props> = ({
    stats, allDiets, onNewClient, onLoadDiet,
    onDeleteDiet, onEditClient, onUpdatePatientData,
    installEvent, onInstall, onExportCSV, onAddPartner, onOpenPortalLink
}) => {
    const [search, setSearch]   = useState('');
    const [filter, setFilter]   = useState<Filter>('all');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [editingDiet, setEditingDiet] = useState<SavedDiet | null>(null);
    const [editForm, setEditForm] = useState<Partial<PatientData>>({});
    const [historyClient, setHistoryClient] = useState<string | null>(null);

    // Una tarjeta por cliente → la dieta más reciente de cada uno
    const latestPerClient: SavedDiet[] = Array.from(
        allDiets
            .reduce((map, d) => {
                const key = d.patientData.name ?? `__anon_${d.id}`;
                if (!map.has(key) || d.timestamp > map.get(key)!.timestamp) map.set(key, d);
                return map;
            }, new Map<string, SavedDiet>())
            .values()
    ).sort((a, b) => b.timestamp - a.timestamp);

    const filtered = latestPerClient.filter(d => {
        const name = (d.patientData.name ?? '').toLowerCase();
        const diet = (DIET_TYPE_LABELS[d.patientData.dietType] ?? d.patientData.dietType).toLowerCase();
        const matchSearch = name.includes(search.toLowerCase()) || diet.includes(search.toLowerCase());
        // "Activo" = plan generado en los últimos 30 días
        const isRecent = Date.now() - d.timestamp < 30 * 24 * 60 * 60 * 1000;
        const matchFilter =
            filter === 'all'      ? true :
            filter === 'active'   ? isRecent :
            /* inactive */          !isRecent;
        return matchSearch && matchFilter;
    });

    // Dietas del cliente seleccionado para el modal de historial
    const historyDiets = historyClient
        ? allDiets.filter(d => d.patientData.name === historyClient).sort((a, b) => b.timestamp - a.timestamp)
        : [];

    const toggleMenu = (id: string) =>
        setMenuOpen(prev => (prev === id ? null : id));

    const closeMenu = () => setMenuOpen(null);

    const openEditModal = (diet: SavedDiet) => {
        setEditingDiet(diet);
        setEditForm({ ...diet.patientData });
        closeMenu();
    };

    const closeEditModal = () => {
        setEditingDiet(null);
        setEditForm({});
    };

    const handleEditSave = () => {
        if (!editingDiet) return;
        onUpdatePatientData(editingDiet.id, editForm);
        closeEditModal();
    };

    const handleConditionToggle = (cond: Condition) => {
        setEditForm(prev => {
            const current = prev.conditions ?? [];
            return {
                ...prev,
                conditions: current.includes(cond)
                    ? current.filter(c => c !== cond)
                    : [...current, cond],
            };
        });
    };

    return (
        <React.Fragment>
        <div className="flex-1 overflow-y-auto p-4 md:p-8" onClick={closeMenu}>
            <div className="max-w-[1200px] mx-auto flex flex-col gap-8 pb-20">

                {/* Header */}
                <header className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex min-w-72 flex-col gap-2">
                        <h1 className="text-text-main dark:text-white text-4xl font-extrabold leading-tight tracking-[-0.033em]">Gestión de Clientes</h1>
                        <p className="text-text-sub dark:text-gray-400 text-base font-normal">Visualiza y administra el progreso de tus pacientes.</p>
                    </div>
                    <div className="flex gap-3">
                        {installEvent && (
                            <button onClick={onInstall} className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm" title="Instalar Aplicación">
                                <span className="material-symbols-outlined">download</span>
                            </button>
                        )}
                        <button onClick={onExportCSV} className="flex size-10 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm" title="Exportar CSV">
                            <span className="material-symbols-outlined">table_view</span>
                        </button>
                        <a
                            href="/cuestionario.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                            title="Descargar cuestionario previo para pacientes"
                        >
                            <span className="material-symbols-outlined text-[18px]">assignment</span>
                            <span className="truncate hidden sm:inline">Cuestionario</span>
                        </a>
                        <button onClick={onNewClient} className="flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-primary text-background-dark text-sm font-bold leading-normal tracking-[0.015em] hover:brightness-90 transition-all shadow-md shadow-primary/20">
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            <span className="truncate">Nuevo Cliente</span>
                        </button>
                    </div>
                </header>

                {/* Stats */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-text-sub dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Total Clientes</p>
                            <span className="material-symbols-outlined text-primary">groups</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-text-main dark:text-white text-3xl font-bold leading-tight">{stats.totalClients}</p>
                            <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">Activos</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-text-sub dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Planes Generados</p>
                            <span className="material-symbols-outlined text-primary">fitness_center</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-text-main dark:text-white text-3xl font-bold leading-tight">{stats.activePlans}</p>
                            <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">+ Recientes</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-text-sub dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Alimentos DB</p>
                            <span className="material-symbols-outlined text-orange-400">database</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-text-main dark:text-white text-3xl font-bold leading-tight">{stats.customFoods}</p>
                            <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-600/20">Personalizados</span>
                        </div>
                    </div>
                </section>

                {/* Search + Filters */}
                <div className="flex flex-col lg:flex-row justify-between gap-4 items-center rounded-xl bg-surface-light dark:bg-surface-dark p-2 border border-border-light dark:border-border-dark shadow-sm">
                    <div className="w-full lg:w-1/2">
                        <label className="flex w-full items-center rounded-lg bg-background-light dark:bg-background-dark border border-transparent focus-within:border-primary px-3 h-12 transition-colors">
                            <span className="material-symbols-outlined text-text-sub dark:text-gray-400">search</span>
                            <input
                                className="w-full border-none bg-transparent p-2 text-text-main dark:text-white placeholder:text-text-sub focus:ring-0 text-base outline-none"
                                placeholder="Buscar por nombre o tipo de dieta..."
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-text-sub hover:text-text-main transition-colors">
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            )}
                        </label>
                    </div>
                    <div className="w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                        <div className="flex gap-2 min-w-max px-2">
                            {(['all', 'active', 'inactive'] as Filter[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`flex h-9 items-center justify-center rounded-lg px-4 text-sm font-bold transition-colors ${
                                        filter === f
                                            ? 'bg-text-main dark:bg-white text-white dark:text-background-dark shadow-md'
                                            : 'bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-main dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {{ all: 'Todos', active: 'Activos', inactive: 'Inactivos' }[f]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Estado vacío de bienvenida (MEJORA-015, iteración 003):
                    sin ningún cliente todavía — mensaje de arranque + CTA,
                    en vez de contadores a 0 y una rejilla vacía sin contexto. */}
                {allDiets.length === 0 && (
                    <section className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4 rounded-2xl border-2 border-dashed border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                        <span className="material-symbols-outlined text-6xl text-primary" aria-hidden="true">nutrition</span>
                        <h2 className="text-xl font-black text-text-main dark:text-white">Bienvenida a tu consulta digital</h2>
                        <p className="text-sm text-text-sub dark:text-gray-400 max-w-md">
                            Todavía no hay ningún cliente registrado. Crea el primero para generar su plan
                            nutricional personalizado en minutos: datos antropométricos, condiciones clínicas,
                            alérgenos y objetivo — el resto lo calcula el sistema.
                        </p>
                        <button
                            onClick={onNewClient}
                            className="mt-2 flex items-center gap-2 rounded-lg h-11 px-6 bg-primary text-background-dark text-sm font-bold hover:brightness-90 transition-all shadow-md shadow-primary/20"
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
                            Crear tu primer cliente
                        </button>
                    </section>
                )}

                {/* Clients Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.length === 0 && search && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 text-text-sub dark:text-gray-400 gap-3">
                            <span className="material-symbols-outlined text-4xl">search_off</span>
                            <p className="font-bold">Sin resultados para "{search}"</p>
                        </div>
                    )}

                    {filtered.map((diet) => {
                        const isRecent = Date.now() - diet.timestamp < 30 * 24 * 60 * 60 * 1000;
                        const principal = diet.linkedToId ? allDiets.find(d => d.id === diet.linkedToId) : undefined;
                        const hasPartner = allDiets.some(d => d.linkedToId === diet.id);
                        const canAddPartner = !diet.linkedToId && !hasPartner && (diet.plan?.weeklyPlan?.length ?? 0) > 0;
                        return (
                            <div
                                key={diet.id}
                                className="group relative flex flex-col justify-between gap-4 rounded-xl bg-surface-light dark:bg-surface-dark p-5 border border-border-light dark:border-border-dark hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                            >
                                {/* Menú contextual */}
                                <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => toggleMenu(diet.id)}
                                        className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <span className="material-symbols-outlined text-base">more_vert</span>
                                    </button>
                                    {menuOpen === diet.id && (
                                        <div className="absolute right-0 top-9 z-50 w-52 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl overflow-hidden">
                                            <button
                                                onClick={() => openEditModal(diet)}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base text-blue-500">manage_accounts</span>
                                                Editar datos
                                            </button>
                                            <button
                                                onClick={() => { onEditClient(diet); closeMenu(); }}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base text-primary">refresh</span>
                                                Nueva dieta
                                            </button>
                                            <button
                                                onClick={() => { setHistoryClient(diet.patientData.name ?? null); closeMenu(); }}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base text-amber-500">history</span>
                                                Historial de dietas
                                            </button>
                                            <button
                                                onClick={() => { onOpenPortalLink(diet); closeMenu(); }}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base text-emerald-500">qr_code_2</span>
                                                Portal del paciente
                                            </button>
                                            {canAddPartner && (
                                                <button
                                                    onClick={() => { onAddPartner(diet); closeMenu(); }}
                                                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-base text-pink-500">add_circle</span>
                                                    Añadir Pareja
                                                </button>
                                            )}
                                            <div className="border-t border-border-light dark:border-border-dark" />
                                            <button
                                                onClick={() => { onDeleteDiet(diet.id); closeMenu(); }}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base">delete</span>
                                                Eliminar plan
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-3 items-center">
                                            <div className="size-12 rounded-full ring-2 ring-transparent group-hover:ring-primary/30 transition-all flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 font-bold text-lg">
                                                {diet.patientData.name ? diet.patientData.name.charAt(0).toUpperCase() : 'P'}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className="text-base font-bold text-text-main dark:text-white truncate pr-8">{diet.patientData.name || 'Paciente'}</h3>
                                                <p className="text-xs text-text-sub dark:text-gray-400">{diet.patientData.age} años • {diet.patientData.weight}kg</p>
                                                {principal && (
                                                    <p className="flex items-center gap-1 text-[10px] text-primary-accessible dark:text-primary font-semibold mt-0.5">
                                                        <span className="material-symbols-outlined text-[12px]">group</span>
                                                        Pareja de {principal.patientData.name || 'paciente'}
                                                    </p>
                                                )}
                                                {!diet.patientData.gdprConsent?.granted && (
                                                    <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5" title="Registra el consentimiento en 'Editar datos'">
                                                        <span className="material-symbols-outlined text-[12px]">warning</span>
                                                        Sin consentimiento RGPD
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                            isRecent
                                                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-green-600/20'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ring-gray-400/20'
                                        }`}>
                                            {isRecent ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-1">Dieta</p>
                                            <div className="flex items-center gap-1.5 text-text-main dark:text-white font-medium text-sm">
                                                <span className="material-symbols-outlined text-base text-primary">restaurant</span>
                                                {DIET_TYPE_LABELS[diet.patientData.dietType] ?? diet.patientData.dietType}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold text-text-sub dark:text-gray-400 uppercase tracking-wider">Calorías</span>
                                                <span className="text-primary-accessible dark:text-primary font-bold">{diet.metrics.tee} kcal</span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-background-light dark:bg-background-dark overflow-hidden">
                                                <div className="h-full rounded-full bg-primary w-3/4" />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-text-sub dark:text-gray-500">
                                            {new Date(diet.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onLoadDiet(diet)}
                                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-background-light dark:bg-background-dark py-2.5 text-sm font-bold text-text-main dark:text-white transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 group-hover:bg-primary group-hover:text-background-dark"
                                >
                                    Ver Plan
                                </button>
                            </div>
                        );
                    })}

                    {/* Add New */}
                    <button onClick={onNewClient} className="group flex flex-col items-center justify-center gap-4 rounded-xl bg-transparent p-5 border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all duration-300 min-h-[220px]">
                        <div className="size-16 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-primary text-3xl">add</span>
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-bold text-text-main dark:text-white">Añadir Cliente</h3>
                            <p className="text-xs text-text-sub dark:text-gray-400 mt-1">Crear nuevo perfil y dieta</p>
                        </div>
                    </button>
                </section>
            </div>
        </div>

        {/* ── Modal edición datos cliente ────────────────────────────────── */}
        {editingDiet && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeEditModal}>
                <div
                    className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-blue-500 text-2xl">manage_accounts</span>
                            <h2 className="text-xl font-bold text-text-main dark:text-white">Editar Datos del Cliente</h2>
                        </div>
                        <button onClick={closeEditModal} className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <span className="material-symbols-outlined text-text-sub">close</span>
                        </button>
                    </div>

                    <div className="p-6 flex flex-col gap-5">
                        {/* Nombre */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase">Nombre completo</span>
                                <input className="h-11 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm"
                                    type="text" value={editForm.name ?? ''}
                                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase">Edad</span>
                                <input className="h-11 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm"
                                    type="number" min="1" max="120" value={editForm.age ?? ''}
                                    onChange={e => setEditForm(p => ({ ...p, age: Number(e.target.value) }))} />
                            </label>
                        </div>

                        {/* Género */}
                        <div>
                            <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase block mb-2">Género biológico</span>
                            <div className="flex rounded-lg bg-background-light dark:bg-background-dark p-1 border border-border-light dark:border-border-dark">
                                {[{ val: Gender.Male, label: 'Hombre' }, { val: Gender.Female, label: 'Mujer' }].map(g => (
                                    <button key={g.val} type="button"
                                        className={`flex-1 rounded py-2 text-sm font-bold transition-all ${editForm.gender === g.val ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white ring-1 ring-black/5 dark:ring-white/10' : 'text-text-sub'}`}
                                        onClick={() => setEditForm(p => ({ ...p, gender: g.val }))}>{g.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Peso / Altura / Objetivo */}
                        <div className="grid grid-cols-3 gap-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase">Peso (kg)</span>
                                <input className="h-11 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm"
                                    type="number" step="0.1" min="20" max="300" value={editForm.weight ?? ''}
                                    onChange={e => setEditForm(p => ({ ...p, weight: Number(e.target.value) }))} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase">Altura (cm)</span>
                                <input className="h-11 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm"
                                    type="number" min="100" max="250" value={editForm.height ?? ''}
                                    onChange={e => setEditForm(p => ({ ...p, height: Number(e.target.value) }))} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase">Obj. peso</span>
                                <input className="h-11 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm"
                                    type="number" step="0.1" value={editForm.targetWeight ?? ''}
                                    onChange={e => setEditForm(p => ({ ...p, targetWeight: e.target.value ? Number(e.target.value) : undefined }))} />
                            </label>
                        </div>

                        {/* Nivel de actividad */}
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase">Nivel de actividad</span>
                            <div className="relative">
                                <select className="h-11 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 pr-8 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm"
                                    value={editForm.activity ?? ''}
                                    onChange={e => setEditForm(p => ({ ...p, activity: e.target.value as ActivityLevel }))}>
                                    <option value={ActivityLevel.Sedentary}>Sedentario</option>
                                    <option value={ActivityLevel.Light}>Ligero</option>
                                    <option value={ActivityLevel.Moderate}>Moderado</option>
                                    <option value={ActivityLevel.Heavy}>Intenso</option>
                                    <option value={ActivityLevel.Athlete}>Atleta</option>
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub text-base">expand_more</span>
                            </div>
                        </label>

                        {/* Alimentos excluidos */}
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase">Alimentos a excluir</span>
                            <input className="h-11 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm"
                                type="text" placeholder="Ej: mariscos, nueces..." value={editForm.excludedFoods ?? ''}
                                onChange={e => setEditForm(p => ({ ...p, excludedFoods: e.target.value }))} />
                        </label>

                        {/* Condiciones */}
                        <div>
                            <span className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase block mb-2">Condiciones clínicas</span>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { val: Condition.DiabetesType2, label: 'Diabetes T2' },
                                    { val: Condition.Hypertension, label: 'Hipertensión' },
                                    { val: Condition.Hypothyroidism, label: 'Hipotiroidismo' },
                                    { val: Condition.Hypertriglyceridemia, label: 'Hipertrigliceridemia' },
                                    { val: Condition.LactoseIntolerance, label: 'Intol. Lactosa' },
                                    { val: Condition.Celiac, label: 'Celiaquía' },
                                    { val: Condition.Obesity, label: 'Obesidad' },
                                    { val: Condition.DiabetesType1, label: 'Diabetes T1' },
                                    { val: Condition.Hyperthyroidism, label: 'Hipertiroidismo' },
                                ].map(c => {
                                    const checked = (editForm.conditions ?? []).includes(c.val);
                                    return (
                                        <label key={c.val} className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer text-xs border transition-colors ${checked ? 'bg-primary/10 border-primary' : 'bg-background-light dark:bg-background-dark border-transparent'}`}>
                                            <input type="checkbox" className="w-3.5 h-3.5 text-primary rounded" checked={checked}
                                                onChange={() => handleConditionToggle(c.val)} />
                                            <span className="font-medium text-text-main dark:text-gray-200">{c.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Consentimiento RGPD */}
                        <label className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer border transition-colors ${editForm.gdprConsent?.granted ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-background-light dark:bg-background-dark border-transparent'}`}>
                            <input
                                type="checkbox"
                                className="w-4 h-4 mt-0.5 text-green-600 rounded focus:ring-green-500"
                                checked={!!editForm.gdprConsent?.granted}
                                onChange={(e) => setEditForm(p => ({
                                    ...p,
                                    gdprConsent: e.target.checked
                                        ? { granted: true, consentedAt: Date.now() }
                                        : undefined,
                                }))}
                            />
                            <span className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-text-main dark:text-gray-200">El paciente ha dado su consentimiento para el tratamiento de sus datos de salud (RGPD)</span>
                                {editForm.gdprConsent?.granted && (
                                    <span className="text-[10px] text-green-700 dark:text-green-400 font-semibold">
                                        Registrado el {new Date(editForm.gdprConsent.consentedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3 p-6 border-t border-border-light dark:border-border-dark">
                        <button onClick={closeEditModal}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark font-bold text-text-main dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button onClick={handleEditSave}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-primary font-bold text-black hover:brightness-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm">
                            <span className="material-symbols-outlined text-[18px]">save</span> Guardar cambios
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Modal historial de dietas por cliente ──────────────────────── */}
        {historyClient && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={() => setHistoryClient(null)}
            >
                <div
                    className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-amber-500 text-2xl">history</span>
                            <div>
                                <h2 className="text-xl font-bold text-text-main dark:text-white">Historial de Dietas</h2>
                                <p className="text-sm text-text-sub dark:text-gray-400">{historyClient} · {historyDiets.length} plan{historyDiets.length !== 1 ? 'es' : ''}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setHistoryClient(null)}
                            className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <span className="material-symbols-outlined text-text-sub">close</span>
                        </button>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1 p-4">
                        {historyDiets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-text-sub dark:text-gray-400 gap-3">
                                <span className="material-symbols-outlined text-4xl">folder_open</span>
                                <p className="font-bold">Sin planes guardados</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {historyDiets.map((d, idx) => {
                                    const isLatest = idx === 0;
                                    const dateStr = new Date(d.timestamp).toLocaleDateString('es-ES', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                    });
                                    const dietLabel = DIET_TYPE_LABELS[d.patientData.dietType] ?? d.patientData.dietType;
                                    const kcal = d.metrics.macros?.calories ?? d.metrics.tee;
                                    return (
                                        <div
                                            key={d.id}
                                            className={`flex items-center gap-4 rounded-xl p-4 border transition-colors ${
                                                isLatest
                                                    ? 'bg-primary/5 border-primary/30'
                                                    : 'bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark'
                                            }`}
                                        >
                                            {/* Timeline dot */}
                                            <div className="flex flex-col items-center gap-1 shrink-0">
                                                <div className={`size-3 rounded-full ${isLatest ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                                {idx < historyDiets.length - 1 && (
                                                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-bold text-text-main dark:text-white">{dateStr}</span>
                                                    {isLatest && (
                                                        <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">
                                                            Más reciente
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-1">
                                                    <span className="flex items-center gap-1 text-xs text-text-sub dark:text-gray-400">
                                                        <span className="material-symbols-outlined text-sm text-primary">restaurant</span>
                                                        {dietLabel}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-xs text-text-sub dark:text-gray-400">
                                                        <span className="material-symbols-outlined text-sm text-orange-400">monitor_weight</span>
                                                        {d.patientData.weight} kg
                                                    </span>
                                                    <span className="flex items-center gap-1 text-xs text-text-sub dark:text-gray-400">
                                                        <span className="material-symbols-outlined text-sm text-blue-400">local_fire_department</span>
                                                        {kcal} kcal
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action */}
                                            <button
                                                onClick={() => { onLoadDiet(d); setHistoryClient(null); }}
                                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-black text-xs font-bold hover:brightness-95 transition-all shadow-sm shadow-primary/20"
                                            >
                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                Ver Plan
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 p-4 border-t border-border-light dark:border-border-dark">
                        <button
                            onClick={() => setHistoryClient(null)}
                            className="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark font-bold text-text-main dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </React.Fragment>
    );
};

export default Dashboard;
