import React, { useState, useEffect } from 'react';
import './EmployeeManagement.css';

const EmployeeManagementTool = ({ societe, isAdminMode = false }) => {
  const [employees, setEmployees] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState({
    annee: new Date().getFullYear(),
    mois: new Date().getMonth() + 1
  });
  const [historiquePeriodes, setHistoriquePeriodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [newEmployee, setNewEmployee] = useState(null);

  const API_BASE = 'http://wk0gkc8oo4w0kw4o0ko088gk.144.76.185.53.sslip.io/api';

  // API calls
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        ...options
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Générer les périodes historiques (12 derniers mois)
  const generateHistoriquePeriodes = () => {
    const periodes = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      periodes.push({
        annee: date.getFullYear(),
        mois: date.getMonth() + 1,
        label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        isCurrent: date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
      });
    }
    
    return periodes;
  };

  // Charger les sociétés
  const loadSocietes = async () => {
    try {
      const data = await apiCall('/societes');
      setSocietes(data.societes || []);
    } catch (error) {
      console.error('Erreur lors du chargement des sociétés:', error);
    }
  };

  // Charger les employés
  const loadEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        annees: selectedPeriod.annee.toString(),
        mois: selectedPeriod.mois.toString(),
        orderBy: 'nom'
      });
      
      if (isAdminMode && societe?.id) {
        params.append('societeId', societe.id);
      }
      
      const data = await apiCall(`/employees?${params}`);
      setEmployees(data.employees || []);
      
      // Charger les statistiques
      const statsData = await apiCall(`/statistics?${params}`);
      setStatistics(statsData.statistics || {});
    } catch (error) {
      console.error('Erreur lors du chargement des employés:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarder employé
  const saveEmployee = async (employeeData, isNew = false) => {
    try {
      if (isNew) {
        const data = await apiCall('/employees', {
          method: 'POST',
          body: JSON.stringify(employeeData)
        });
        return data.employee;
      } else {
        const data = await apiCall(`/employees/${employeeData.id}`, {
          method: 'PUT',
          body: JSON.stringify(employeeData)
        });
        return data.employee;
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      throw error;
    }
  };

  // Supprimer employé
  const deleteEmployee = async (employeeId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) {
      return;
    }

    try {
      await apiCall(`/employees/${employeeId}`, {
        method: 'DELETE'
      });
      loadEmployees();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Gestion de l'édition inline
  const handleCellEdit = async (employeeId, field, value) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      const updatedEmployee = { ...employee, [field]: value };
      await saveEmployee(updatedEmployee);
      
      // Mettre à jour localement
      setEmployees(prev => prev.map(emp => 
        emp.id === employeeId ? { ...emp, [field]: value } : emp
      ));
      
      setEditingCell(null);
    } catch (error) {
      alert('Erreur lors de la mise à jour');
    }
  };

  // Ajouter un nouvel employé
  const addNewEmployee = () => {
    const newEmp = {
      nom: '',
      prenom: '',
      heuresContrat: 0,
      congesPayes: 0,
      absences: 0,
      arretMaladie: 0,
      heuresSupplementaires: 0,
      prime: 0,
      accompte: 0,
      repas: 0,
      transport: 0,
      demission: false,
      rupture: false,
      partSociete: '',
      annees: selectedPeriod.annee,
      mois: selectedPeriod.mois,
      societeId: societe?.id || '',
      isNew: true
    };
    setNewEmployee(newEmp);
  };

  // Sauvegarder le nouvel employé
  const saveNewEmployee = async () => {
    try {
      if (!newEmployee.nom || !newEmployee.prenom) {
        alert('Nom et prénom sont requis');
        return;
      }

      const saved = await saveEmployee(newEmployee, true);
      setEmployees(prev => [...prev, saved]);
      setNewEmployee(null);
      loadEmployees(); // Recharger pour les statistiques
    } catch (error) {
      alert('Erreur lors de l\'ajout de l\'employé');
    }
  };

  // Initialiser le composant
  useEffect(() => {
    const periodes = generateHistoriquePeriodes();
    setHistoriquePeriodes(periodes);
    loadSocietes();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [selectedPeriod, societe]);

  const getMonthName = (monthNumber) => {
    return new Date(2025, monthNumber - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
  };

  // Composant cellule éditable
  const EditableCell = ({ value, onSave, type = 'text', employeeId, field }) => {
    const [editValue, setEditValue] = useState(value);
    const isEditing = editingCell === `${employeeId}-${field}`;

    const handleSave = () => {
      let processedValue = editValue;

      if (type === 'number') {
        processedValue = parseFloat(editValue) || 0;
      } else if (type === 'integer') {
        processedValue = parseInt(editValue) || 0;
      } else if (type === 'checkbox') {
        processedValue = Boolean(editValue);
      }

      onSave(processedValue);
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setEditValue(value);
        setEditingCell(null);
      }
    };

    if (isEditing) {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            className="editable-cell-checkbox"
            checked={editValue}
            onChange={(e) => setEditValue(e.target.checked)}
            onBlur={handleSave}
            autoFocus
          />
        );
      }

      return (
        <input
          type={type === 'integer' ? 'number' : type}
          className="editable-cell-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyPress}
          autoFocus
        />
      );
    }

    return (
      <div
        className="editable-cell"
        onClick={() => {
          setEditingCell(`${employeeId}-${field}`);
          setEditValue(value);
        }}
        title="Cliquez pour éditer"
      >
        {type === 'checkbox' ? (value ? '✓' : '✗') : (value || '—')}
      </div>
    );
  };

  // En-tête avec informations société
  const renderHeader = () => (
    <div className="header">
      <div className="header-content">
        <div className="header-left">
          <h1>
            {isAdminMode && societe ? societe.nom : 'Gestion des Employés'}
          </h1>
          {isAdminMode && societe && (
            <div className="header-info">
              <div>
                <strong>Responsable:</strong> {societe.gerant}
              </div>
              {societe.dateCreation && (
                <div>
                  <strong>Date de création:</strong> {new Date(societe.dateCreation).toLocaleDateString('fr-FR')}
                </div>
              )}
              {societe.siret && (
                <div>
                  <strong>SIRET:</strong> {societe.siret}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="header-right">
          <div className="current-period">
            <h3>Période en cours</h3>
            <div className="current-period-value">
              {getMonthName(selectedPeriod.mois)} {selectedPeriod.annee}
            </div>
          </div>
          
          <select 
            className="period-selector"
            value={`${selectedPeriod.annee}-${selectedPeriod.mois}`}
            onChange={(e) => {
              const [annee, mois] = e.target.value.split('-');
              setSelectedPeriod({ annee: parseInt(annee), mois: parseInt(mois) });
            }}
          >
            {historiquePeriodes.map(periode => (
              <option 
                key={`${periode.annee}-${periode.mois}`} 
                value={`${periode.annee}-${periode.mois}`}
              >
                {periode.label} {periode.isCurrent ? '(Actuel)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  // Historique des périodes
  const renderHistorique = () => (
    <div className="historique">
      <h4>📅 Historique des périodes</h4>
      <div className="historique-grid">
        {historiquePeriodes.slice(-6).map(periode => (
          <div 
            key={`${periode.annee}-${periode.mois}`}
            className={`historique-item ${
              periode.annee === selectedPeriod.annee && periode.mois === selectedPeriod.mois ? 'selected' : ''
            } ${periode.isCurrent ? 'current' : ''}`}
            onClick={() => setSelectedPeriod({ annee: periode.annee, mois: periode.mois })}
          >
            <div className="historique-month">
              {getMonthName(periode.mois)}
            </div>
            <div className="historique-year">
              {periode.annee}
            </div>
            {periode.isCurrent && (
              <div className="historique-current-indicator">●</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Statistiques
  const renderStatistics = () => (
    <div className="statistics-grid">
      <div className="stat-card employees">
        <div className="stat-card-content">
          <div className="stat-card-icon">👥</div>
          <div className="stat-card-text">
            <h3>Total Employés</h3>
            <span className="stat-card-value">{statistics.totalEmployees || 0}</span>
          </div>
        </div>
      </div>
      
      <div className="stat-card hours">
        <div className="stat-card-content">
          <div className="stat-card-icon">🕐</div>
          <div className="stat-card-text">
            <h3>Heures Totales</h3>
            <span className="stat-card-value">{statistics.totalHours || 0}h</span>
          </div>
        </div>
      </div>
      
      <div className="stat-card conges">
        <div className="stat-card-content">
          <div className="stat-card-icon">📅</div>
          <div className="stat-card-text">
            <h3>Congés Payés</h3>
            <span className="stat-card-value">{statistics.totalConges || 0}</span>
          </div>
        </div>
      </div>
      
      <div className="stat-card primes">
        <div className="stat-card-content">
          <div className="stat-card-icon">💰</div>
          <div className="stat-card-text">
            <h3>Primes Totales</h3>
            <span className="stat-card-value">{statistics.totalPrimes || 0}€</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Tableau des employés
  const renderEmployeeTable = () => (
    <div className="employee-table-container">
      <div className="employee-table-header">
        <h3 className="employee-table-title">
          Liste des Employés - {getMonthName(selectedPeriod.mois)} {selectedPeriod.annee}
        </h3>
        <button 
          className="add-employee-btn"
          onClick={addNewEmployee}
        >
          ➕ Nouvel Employé
        </button>
      </div>
      
      {loading ? (
        <div className="loading">
          Chargement...
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="employee-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th className="center">Heures Contrat</th>
                <th className="center">H. Sup.</th>
                <th className="center">Congés</th>
                <th className="center">Absences</th>
                <th className="center">Maladie</th>
                <th className="center">Prime €</th>
                <th className="center">Accompte €</th>
                <th className="center">Repas €</th>
                <th className="center">Transport €</th>
                <th className="center">Démission</th>
                <th className="center">Rupture</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {newEmployee && (
                <tr className="new-employee-row">
                  <td>
                    <div className="new-employee-name-inputs">
                      <input
                        type="text"
                        placeholder="Prénom"
                        value={newEmployee.prenom}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, prenom: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Nom"
                        value={newEmployee.nom}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, nom: e.target.value }))}
                      />
                    </div>
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      className="new-employee-input narrow"
                      value={newEmployee.heuresContrat}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, heuresContrat: parseInt(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      className="new-employee-input narrow"
                      value={newEmployee.heuresSupplementaires}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, heuresSupplementaires: parseInt(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      className="new-employee-input narrow"
                      value={newEmployee.congesPayes}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, congesPayes: parseInt(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      className="new-employee-input narrow"
                      value={newEmployee.absences}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, absences: parseInt(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      className="new-employee-input narrow"
                      value={newEmployee.arretMaladie}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, arretMaladie: parseInt(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      step="0.01"
                      className="new-employee-input wide"
                      value={newEmployee.prime}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, prime: parseFloat(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      step="0.01"
                      className="new-employee-input wide"
                      value={newEmployee.accompte}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, accompte: parseFloat(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      step="0.01"
                      className="new-employee-input wide"
                      value={newEmployee.repas}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, repas: parseFloat(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="number"
                      step="0.01"
                      className="new-employee-input wide"
                      value={newEmployee.transport}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, transport: parseFloat(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={newEmployee.demission}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, demission: e.target.checked }))}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={newEmployee.rupture}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, rupture: e.target.checked }))}
                    />
                  </td>
                  <td className="center">
                    <button
                      className="action-btn save"
                      onClick={saveNewEmployee}
                    >
                      ✓
                    </button>
                    <button
                      className="action-btn cancel"
                      onClick={() => setNewEmployee(null)}
                    >
                      ✗
                    </button>
                  </td>
                </tr>
              )}
              
              {employees.map(employee => (
                <tr key={employee.id}>
                  <td>
                    <div>
                      <EditableCell
                        value={employee.prenom}
                        onSave={(value) => handleCellEdit(employee.id, 'prenom', value)}
                        employeeId={employee.id}
                        field="prenom"
                      />
                      <EditableCell
                        value={employee.nom}
                        onSave={(value) => handleCellEdit(employee.id, 'nom', value)}
                        employeeId={employee.id}
                        field="nom"
                      />
                    </div>
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.heuresContrat}
                      onSave={(value) => handleCellEdit(employee.id, 'heuresContrat', value)}
                      type="integer"
                      employeeId={employee.id}
                      field="heuresContrat"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.heuresSupplementaires}
                      onSave={(value) => handleCellEdit(employee.id, 'heuresSupplementaires', value)}
                      type="integer"
                      employeeId={employee.id}
                      field="heuresSupplementaires"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.congesPayes}
                      onSave={(value) => handleCellEdit(employee.id, 'congesPayes', value)}
                      type="integer"
                      employeeId={employee.id}
                      field="congesPayes"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.absences}
                      onSave={(value) => handleCellEdit(employee.id, 'absences', value)}
                      type="integer"
                      employeeId={employee.id}
                      field="absences"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.arretMaladie}
                      onSave={(value) => handleCellEdit(employee.id, 'arretMaladie', value)}
                      type="integer"
                      employeeId={employee.id}
                      field="arretMaladie"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.prime}
                      onSave={(value) => handleCellEdit(employee.id, 'prime', value)}
                      type="number"
                      employeeId={employee.id}
                      field="prime"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.accompte}
                      onSave={(value) => handleCellEdit(employee.id, 'accompte', value)}
                      type="number"
                      employeeId={employee.id}
                      field="accompte"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.repas}
                      onSave={(value) => handleCellEdit(employee.id, 'repas', value)}
                      type="number"
                      employeeId={employee.id}
                      field="repas"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.transport}
                      onSave={(value) => handleCellEdit(employee.id, 'transport', value)}
                      type="number"
                      employeeId={employee.id}
                      field="transport"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.demission}
                      onSave={(value) => handleCellEdit(employee.id, 'demission', value)}
                      type="checkbox"
                      employeeId={employee.id}
                      field="demission"
                    />
                  </td>
                  <td className="center">
                    <EditableCell
                      value={employee.rupture}
                      onSave={(value) => handleCellEdit(employee.id, 'rupture', value)}
                      type="checkbox"
                      employeeId={employee.id}
                      field="rupture"
                    />
                  </td>
                  <td className="center">
                    <button
                      className="action-btn delete"
                      onClick={() => deleteEmployee(employee.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderDashboard = () => (
    <div>
      {renderHeader()}
      {renderHistorique()}
      {renderStatistics()}
      {renderEmployeeTable()}
    </div>
  );

  return renderDashboard();
};

export default EmployeeManagementTool;