import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  CreditCard,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const Expenses = () => {
  const { selectedShop } = useAuth();
  const { activeTheme } = useTheme();
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenses, setExpenses] = useState([]);
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form State
  const [category, setCategory] = useState('MISC');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [recipient, setRecipient] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const {
    page,
    setPage,
    limit,
    setLimit,
    sortBy,
    sortOrder,
    handleSort,
    search,
    setSearch,
    debouncedSearch,
    paginationParams,
    getNextRequestId,
    isCurrentRequest
  } = usePagination({
    initialPage: 1,
    initialLimit: 25,
    initialSortBy: 'createdAt',
    initialSortOrder: 'desc'
  });

  const [paginationMeta, setPaginationMeta] = useState({
    page: 1,
    limit: 25,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });

  const fetchExpenses = async () => {
    if (!selectedShop) return;
    setLoading(true);
    const reqId = getNextRequestId();
    try {
      const params = {
        ...paginationParams,
        date: businessDate
      };
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }

      const res = await apiClient.get('/sales/expenses', { params });
      if (isCurrentRequest(reqId) && res.success) {
        setExpenses(res.data.expenses || []);
        setTotalAmount(res.data.totalExpenseAmount || '0.00');
        if (res.data.pagination) {
          setPaginationMeta(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      if (isCurrentRequest(reqId)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [businessDate, selectedShop?.id, debouncedSearch, categoryFilter, page, limit, sortBy, sortOrder]);

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
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header & Date Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
              Daily Expenses
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Active Shop: <strong style={{ color: activeTheme.primary }}>{selectedShop?.name}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 self-start sm:self-auto">
            <Calendar className="w-4 h-4 shrink-0" style={{ color: activeTheme.primary }} />
            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="bg-transparent text-slate-800 font-mono text-xs focus:outline-none cursor-pointer"
              aria-label="Select expense date"
            />
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add Expense Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plus className="w-4 h-4" style={{ color: activeTheme.primary }} />
            Add New Expense for {businessDate}
          </h2>

          <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:outline-none focus-theme"
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
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Ice purchase, Cartage, Given to Raju"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:outline-none focus-theme placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs focus:outline-none focus-theme font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:outline-none focus-theme"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / Online</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Recipient / Given To</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Optional person name"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:outline-none focus-theme placeholder-slate-400"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
                style={{ backgroundColor: activeTheme.primary }}
              >
                <Plus className="w-4 h-4" />
                {submitting ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses by description, recipient, or category..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus-theme"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus-theme cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="MISC">Misc</option>
              <option value="SALARY">Salary / Staff</option>
              <option value="RENT">Rent / Lease</option>
              <option value="UTILITY">Electricity / Water</option>
              <option value="TRANSPORT">Freight / Transport</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="TEA_SNACKS">Tea & Snacks</option>
              <option value="GOVT_FEE">Govt / License Fees</option>
            </select>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Itemized Expenses ({paginationMeta.totalRecords})
            </h2>
            <div className="text-xs sm:text-sm font-mono font-bold text-rose-600">
              Total: ₹{totalAmount}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No expenses recorded matching the current filter.
            </div>
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="md:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2">
                {expenses.map((exp) => (
                  <div key={exp.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                          style={{
                            backgroundColor: activeTheme.light,
                            color: activeTheme.primary,
                            borderColor: activeTheme.border
                          }}
                        >
                          {exp.category}
                        </span>
                        <h4 className="font-semibold text-slate-900 text-sm mt-1">{exp.description}</h4>
                        {exp.recipient && (
                          <p className="text-xs text-slate-500 mt-0.5">To: {exp.recipient}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-rose-600 font-mono">
                          ₹{parseFloat(exp.amount).toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-slate-500 uppercase mt-0.5">{exp.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1 border-t border-slate-200">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block table-grid-wrapper">
                <table className="table-grid">
                  <thead>
                    <tr>
                      <th 
                        className="w-32 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('category')}
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>Category</span>
                          {sortBy === 'category' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th>Description</th>
                      <th className="w-36">Recipient</th>
                      <th className="w-28 text-center">Payment</th>
                      <th 
                        className="w-32 text-right cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>Amount</span>
                          {sortBy === 'amount' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th className="w-20 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{
                              backgroundColor: activeTheme.light,
                              color: activeTheme.primary,
                              borderColor: activeTheme.border
                            }}
                          >
                            {exp.category}
                          </span>
                        </td>
                        <td className="font-sans font-semibold text-slate-900">{exp.description}</td>
                        <td className="text-slate-600 font-sans">{exp.recipient || '—'}</td>
                        <td className="text-center text-slate-600">{exp.paymentMethod}</td>
                        <td className="text-right font-bold text-rose-600 font-sans">
                          ₹{parseFloat(exp.amount).toFixed(2)}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
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

              {/* Server-Side Pagination Footer */}
              <Pagination
                pagination={paginationMeta}
                onPageChange={setPage}
                onLimitChange={setLimit}
                disabled={loading}
              />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Expenses;
