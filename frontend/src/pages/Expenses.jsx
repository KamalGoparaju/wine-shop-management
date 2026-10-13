import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  CreditCard 
} from 'lucide-react';

const Expenses = () => {
  const { selectedShop } = useAuth();
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenses, setExpenses] = useState([]);
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [loading, setLoading] = useState(true);

  // Form State
  const [category, setCategory] = useState('MISC');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [recipient, setRecipient] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchExpenses = async () => {
    if (!selectedShop) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/sales/expenses', {
        params: { date: businessDate }
      });
      if (res.success) {
        setExpenses(res.data.expenses || []);
        setTotalAmount(res.data.totalExpenseAmount || '0.00');
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [businessDate, selectedShop?.id]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid expense amount greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        businessDate,
        category,
        description,
        amount: parseFloat(amount),
        paymentMethod,
        recipient: recipient.trim() || null
      };

      const res = await apiClient.post('/sales/expenses', payload);
      if (res.success) {
        setSuccessMsg('Expense added successfully');
        setDescription('');
        setAmount('');
        setRecipient('');
        fetchExpenses();
      }
    } catch (err) {
      setError(err?.message || 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await apiClient.delete(`/sales/expenses/${id}`);
      fetchExpenses();
    } catch (err) {
      alert(err?.message || 'Failed to delete expense.');
    }
  };

  return (
    <Layout title="Daily Expense Management">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-amber-500" />
              Daily Expenses
            </h1>
            <p className="text-sm text-slate-400">
              Active Shop: <strong className="text-amber-400">{selectedShop?.name}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add Expense Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Plus className="w-4 h-4 text-amber-500" />
            Add New Expense for {businessDate}
          </h2>

          <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="MISC">Miscellaneous Shop Cost</option>
                <option value="TRANSPORT">Transport / Loading</option>
                <option value="REFRESHMENTS">Tea / Refreshments</option>
                <option value="PERSON_TRANSFER">Money Given to Person</option>
                <option value="SALARY">Staff Daily Advance</option>
                <option value="MAINTENANCE">Shop Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Ice purchase, Cartage, Given to Raju"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-emerald-400 font-mono text-xs focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / Online</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Recipient / Given To</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Optional person name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-amber-900/20 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {submitting ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </div>

        {/* Expenses List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Itemized Expenses ({expenses.length})
            </h2>
            <div className="text-sm font-mono font-bold text-rose-400">
              Total: ₹{totalAmount}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No expenses recorded for {businessDate}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-800/40">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold text-white">{exp.description}</td>
                      <td className="px-4 py-3 text-slate-400 font-sans">{exp.recipient || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{exp.paymentMethod}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-400 font-sans">
                        ₹{parseFloat(exp.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/30 transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Expenses;
