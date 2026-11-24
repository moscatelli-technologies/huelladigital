"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Trash2,
  Building2,
  Clock,
  ShieldCheck,
  Power,
  MapPin,
  ExternalLink,
} from "lucide-react";

function extractClinic(clinics: any) {
  if (Array.isArray(clinics)) return clinics[0] || null;
  return clinics || null;
}

export default function ModuleClinics() {
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [clinicMessage, setClinicMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Formulario Alta/Edición
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [clinicData, setClinicData] = useState({
    clinicName: "",
    branchName: "",
    city: "Posadas",
    address: "",
    mapsUrl: "",
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("clinic_branches")
        .select(
          `id, clinic_id, name, city, address, maps_url, is_active, created_at, clinics(name, cuit)`
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error("Error obteniendo sucursales:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveBranch = async (id: string, displayLabel: string) => {
    setActionId(id);
    setClinicMessage(null);
    try {
      const { error } = await supabase
        .from("clinic_branches")
        .update({ is_active: true })
        .eq("id", id);

      if (error) throw error;
      setClinicMessage({
        text: `${displayLabel} dada de alta y habilitada en el sistema.`,
        type: "success",
      });
      await fetchBranches();
    } catch (error: any) {
      setClinicMessage({
        text: error.message || "No se pudo dar de alta la sucursal.",
        type: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleToggleActive = async (branch: any) => {
    const nextActive = !branch.is_active;
    const clinic = extractClinic(branch.clinics);
    const label = clinic?.name ? `${clinic.name} - ${branch.name}` : branch.name;

    setActionId(branch.id);
    setClinicMessage(null);
    try {
      const { error } = await supabase
        .from("clinic_branches")
        .update({ is_active: nextActive })
        .eq("id", branch.id);

      if (error) throw error;
      setClinicMessage({
        text: nextActive
          ? `${label} activada correctamente.`
          : `${label} pausada / desactivada del directorio y mostrador.`,
        type: "success",
      });
      await fetchBranches();
    } catch (error: any) {
      setClinicMessage({
        text: error.message || "Error al cambiar el estado de la sucursal.",
        type: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (branch: any) => {
    const clinic = extractClinic(branch.clinics);
    const label = clinic?.name ? `${clinic.name} - ${branch.name}` : branch.name;

    if (
      !window.confirm(
        `¿Eliminar definitivamente "${label}" de la base de datos? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setActionId(branch.id);
    setClinicMessage(null);
    try {
      // Desvincular perfiles que apuntaran a esta sucursal para evitar bloqueo de FK
      await supabase
        .from("profiles")
        .update({ branch_id: null })
        .eq("branch_id", branch.id);

      const { error } = await supabase
        .from("clinic_branches")
        .delete()
        .eq("id", branch.id);

      if (error) {
        if (error.code === "23503") {
          throw new Error(
            "No se puede eliminar porque tiene historial clínico o turnos asociados. Usá el botón de Pausar."
          );
        }
        throw error;
      }

      // Si la clínica padre ya no tiene otras sucursales, eliminarla también
      if (branch.clinic_id) {
        const { count } = await supabase
          .from("clinic_branches")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", branch.clinic_id);

        if (count === 0) {
          await supabase.from("clinics").delete().eq("id", branch.clinic_id);
        }
      }

      if (editingId === branch.id) {
        setIsEditing(false);
        setEditingId(null);
        setClinicData({
          clinicName: "",
          branchName: "",
          city: "Posadas",
          address: "",
          mapsUrl: "",
        });
      }

      setClinicMessage({
        text: `"${label}" eliminada definitivamente.`,
        type: "success",
      });
      await fetchBranches();
    } catch (error: any) {
      setClinicMessage({
        text: error.message || "Error al eliminar la sucursal.",
        type: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setClinicMessage(null);

    const cleanMapsUrl = clinicData.mapsUrl.trim() || null;

    try {
      if (isEditing && editingId) {
        const { error } = await supabase
          .from("clinic_branches")
          .update({
            name: clinicData.branchName,
            city: clinicData.city,
            address: clinicData.address,
            maps_url: cleanMapsUrl,
          })
          .eq("id", editingId);
        if (error) throw error;
        setClinicMessage({
          text: "Sucursal actualizada con éxito.",
          type: "success",
        });
      } else {
        const { data: clinicRes, error: clinicError } = await supabase
          .from("clinics")
          .insert([{ name: clinicData.clinicName }])
          .select("id")
          .single();
        if (clinicError) throw clinicError;

        const { error: branchError } = await supabase
          .from("clinic_branches")
          .insert([
            {
              clinic_id: clinicRes.id,
              name: clinicData.branchName,
              city: clinicData.city,
              address: clinicData.address,
              maps_url: cleanMapsUrl,
              is_active: true,
            },
          ]);
        if (branchError) throw branchError;

        setClinicMessage({
          text: "Clínica y sucursal creadas y habilitadas exitosamente.",
          type: "success",
        });
      }

      setClinicData({
        clinicName: "",
        branchName: "",
        city: "Posadas",
        address: "",
        mapsUrl: "",
      });
      setIsEditing(false);
      setEditingId(null);
      await fetchBranches();
    } catch (error: any) {
      setClinicMessage({
        text: error.message || "Error en la operación.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (branch: any) => {
    const clinic = extractClinic(branch.clinics);
    setIsEditing(true);
    setEditingId(branch.id);
    setClinicData({
      clinicName: clinic?.name || "Clínica",
      branchName: branch.name,
      city: branch.city,
      address: branch.address,
      mapsUrl: branch.maps_url || "",
    });
  };

  const pendingBranches = branches.filter((b) => !b.is_active);
  const activeBranches = branches.filter((b) => Boolean(b.is_active));

  return (
    <div className="p-6 sm:p-8 animate-in fade-in duration-300 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          Infraestructura y Directorio
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Dá de alta nuevas clínicas y sucursales, administrá las habilitadas
          y editá su ubicación en Misiones.
        </p>
      </div>

      {clinicMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-start gap-2 ${
            clinicMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {clinicMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{clinicMessage.text}</span>
        </div>
      )}

      {/* Solicitudes Pendientes de Alta */}
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-900">
              Solicitudes de Alta de Sucursales ({pendingBranches.length})
            </h3>
          </div>
          <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
            Esperando habilitación
          </span>
        </div>

        {pendingBranches.length === 0 ? (
          <p className="text-xs text-amber-900/75 font-medium bg-white/80 p-3.5 rounded-xl border border-amber-200/70">
            No hay sucursales pendientes de alta en este momento.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingBranches.map((branch) => {
              const clinic = extractClinic(branch.clinics);
              const clinicTitle = clinic?.name || "Clínica sin nombre";
              const label = `${clinicTitle} • ${branch.name}`;

              return (
                <div
                  key={branch.id}
                  className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-bold text-slate-800 text-sm">
                        {clinicTitle}
                      </span>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">
                        {branch.name}
                      </span>
                      {clinic?.cuit && (
                        <span className="text-[11px] font-mono text-slate-500">
                          CUIT: {clinic.cuit}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                      <span>
                        {branch.address || "Sin dirección"} ({branch.city})
                      </span>
                      {branch.maps_url && (
                        <a
                          href={branch.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Ver pin</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={actionId === branch.id}
                      onClick={() => handleApproveBranch(branch.id, label)}
                      className="min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
                    >
                      {actionId === branch.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Dar de Alta</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={actionId === branch.id}
                      onClick={() => handleDelete(branch)}
                      className="min-h-[40px] px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all disabled:opacity-60 cursor-pointer"
                      title="Eliminar solicitud"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulario de Alta / Edición */}
      <form onSubmit={handleSaveClinic} className="space-y-4 max-w-xl">
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold uppercase text-slate-500">
              {isEditing ? "Editando Sucursal" : "Nueva Infraestructura"}
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditingId(null);
                  setClinicData({
                    clinicName: "",
                    branchName: "",
                    city: "Posadas",
                    address: "",
                    mapsUrl: "",
                  });
                }}
                className="text-xs text-indigo-600 font-bold underline cursor-pointer"
              >
                Cancelar Edición
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Nombre Comercial (Cadena/Clínica)
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={clinicData.clinicName}
                onChange={(e) =>
                  setClinicData({ ...clinicData, clinicName: e.target.value })
                }
                className="w-full px-4 py-2 text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Nombre Sucursal
                </label>
                <input
                  type="text"
                  required
                  value={clinicData.branchName}
                  onChange={(e) =>
                    setClinicData({
                      ...clinicData,
                      branchName: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Localidad
                </label>
                <select
                  value={clinicData.city}
                  onChange={(e) =>
                    setClinicData({ ...clinicData, city: e.target.value })
                  }
                  className="w-full px-4 py-2.5 text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Posadas">Posadas</option>
                  <option value="Oberá">Oberá</option>
                  <option value="Eldorado">Eldorado</option>
                  <option value="Puerto Iguazú">Puerto Iguazú</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Dirección Física
              </label>
              <input
                type="text"
                required
                value={clinicData.address}
                onChange={(e) =>
                  setClinicData({ ...clinicData, address: e.target.value })
                }
                className="w-full px-4 py-2 text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Enlace de Google Maps{" "}
                <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="url"
                placeholder="https://maps.app.goo.gl/..."
                value={clinicData.mapsUrl}
                onChange={(e) =>
                  setClinicData({ ...clinicData, mapsUrl: e.target.value })
                }
                className="w-full px-4 py-2 text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Pegá el link de "Compartir" de Google Maps para fijar
                el pin exacto en el directorio.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl mt-4 disabled:opacity-70 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>
                {isEditing
                  ? "Guardar Cambios"
                  : "Registrar Infraestructura"}
              </span>
            )}
          </button>
        </div>
      </form>

      {/* Tabla de Sucursales Activas */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Sucursales Activas ({activeBranches.length})
        </h3>
        <div className="border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4 border-b border-slate-200">
                  Clínica / Cadena
                </th>
                <th className="py-3 px-4 border-b border-slate-200">
                  Sucursal
                </th>
                <th className="py-3 px-4 border-b border-slate-200">
                  Ubicación
                </th>
                <th className="py-3 px-4 border-b border-slate-200 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {activeBranches.map((branch) => {
                const clinic = extractClinic(branch.clinics);
                return (
                  <tr key={branch.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-indigo-700">
                      {clinic?.name}
                    </td>
                    <td className="py-3 px-4">{branch.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span>
                          {branch.address} ({branch.city})
                        </span>
                        {branch.maps_url && (
                          <a
                            href={branch.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100"
                            title="Abrir ubicación exacta en Google Maps"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Pin</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(branch)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar sucursal"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={actionId === branch.id}
                        onClick={() => handleToggleActive(branch)}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Pausar / desactivar sucursal"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={actionId === branch.id}
                        onClick={() => handleDelete(branch)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar definitivamente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {activeBranches.length === 0 && !isLoading && (
            <div className="p-6 text-center text-slate-500">
              No hay sucursales activas registradas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}