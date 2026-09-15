import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  LayoutDashboard,
  Database,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Building2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Settings,
  Pencil,
  Cloud,
  CloudCheck,
  RefreshCw
} from 'lucide-react';

// --- Firebase 클라우드 DB 설정 (foodwin-holdings-management) ---
const firebaseConfig = {
  apiKey: "AIzaSyAjqevr4YehhmZOst2xg4did41uMl3-zmE",
  authDomain: "foodwin-holdings-management.firebaseapp.com",
  projectId: "foodwin-holdings-management",
  storageBucket: "foodwin-holdings-management.firebasestorage.app",
  messagingSenderId: "534935723633",
  appId: "1:534935723633:web:e179ccaec51281310205d0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const docRef = doc(db, 'fwManage_dash', 'mainData');

// 기본 등록 회사 목록
const INITIAL_COMPANIES = ['푸드윈', '파인쿡', '에이프린트', '코리아프린테크', '진농'];

// 기본 지표 목록
const INITIAL_ROWS = [
  { id: 'income', name: '수입', calcType: '+', isPercentage: false, isBuiltIn: true, isCalculated: false },
  { id: 'revenue', name: '지출합계', calcType: '-', isPercentage: false, isBuiltIn: true, isCalculated: false },
  { id: 'op_profit', name: '손익', calcType: 'calc', isPercentage: false, isBuiltIn: true, isCalculated: true },
  { id: 'op_margin', name: '손익률', calcType: 'calc', isPercentage: true, isBuiltIn: true, isCalculated: true },
];

// 업체 동향 메모 기본값
const INITIAL_MEMOS = {
  '푸드윈': '25년 대비 특판 포장 선물세트 출고량 급증',
  '파인쿡': '부스터 북 정기 교재 및 단체 키트 납품 확대',
  '에이프린트': '디지털 소량 할인 배너 프로모션 진행 중',
  '코리아프린테크': '신규 프랜차이즈 용기 계약 체결 완료',
  '진농': '원자재 가격 안정화로 이익률 개선',
};

// 데이터 시드
const generateInitialMatrix = () => {
  const years = [2025, 2026];
  const initial = {};

  const baseValues = {
    '푸드윈': { 2025: 110389455, 2026: 99767636 },
    '파인쿡': { 2025: 68419592, 2026: 83951091 },
    '에이프린트': { 2025: 45210000, 2026: 52100000 },
    '코리아프린테크': { 2025: 38100000, 2026: 41200000 },
    '진농': { 2025: 29500000, 2026: 34800000 },
  };

  years.forEach((y) => {
    initial[y] = {};
    INITIAL_COMPANIES.forEach((comp) => {
      initial[y][comp] = {};
      const baseRev = baseValues[comp]?.[y] || (y === 2025 ? 40000000 : 45000000);
      for (let m = 1; m <= 12; m++) {
        const factor = 0.85 + (m * 0.03);
        const monthlyExpense = Math.round(baseRev * factor);
        const monthlyIncome = Math.round(monthlyExpense * 1.16); // 수입 = 지출 + 손익
        initial[y][comp][m] = {
          income: monthlyIncome,
          revenue: monthlyExpense,
        };
      }
    });
  });

  return initial;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedCompany, setSelectedCompany] = useState('푸드윈');
  const [selectedMonth, setSelectedMonth] = useState(8);

  const [companies, setCompanies] = useState(INITIAL_COMPANIES);
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [matrixData, setMatrixData] = useState(generateInitialMatrix);
  const [companyMemos, setCompanyMemos] = useState(INITIAL_MEMOS);
  const [syncStatus, setSyncStatus] = useState('동기화 중...');

  // 모달 상태
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingCompOldName, setEditingCompOldName] = useState(null);
  const [tempCompName, setTempCompName] = useState('');

  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [newRowName, setNewRowName] = useState('');
  const [newRowCalcType, setNewRowCalcType] = useState('+');

  const [editingRow, setEditingRow] = useState(null);

  // -------------------------------------------------------------
  // 1. Firebase Firestore 클라우드 실시간 데이터 연동
  // -------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.matrixData) setMatrixData(data.matrixData);
        if (data.companies) setCompanies(data.companies);
        if (data.rows) {
          let updatedRows = [...data.rows];
          if (!updatedRows.some((r) => r.id === 'income')) {
            updatedRows.unshift({ id: 'income', name: '수입', calcType: '+', isPercentage: false, isBuiltIn: true, isCalculated: false });
          }
          const sanitizedRows = updatedRows.map((r) => {
            if (r.id === 'income') return { ...r, name: '수입', calcType: '+', isCalculated: false };
            if (r.id === 'revenue') return { ...r, name: '지출합계', calcType: '-', isCalculated: false };
            if (r.id === 'op_profit') return { ...r, name: '손익', calcType: 'calc', isCalculated: true };
            if (r.id === 'op_margin') return { ...r, name: '손익률', calcType: 'calc', isCalculated: true };
            return r;
          });
          setRows(sanitizedRows);
        }
        if (data.companyMemos) setCompanyMemos(data.companyMemos);
        setSyncStatus('클라우드 연결됨');
      } else {
        const initialMatrix = generateInitialMatrix();
        setDoc(docRef, {
          matrixData: initialMatrix,
          companies: INITIAL_COMPANIES,
          rows: INITIAL_ROWS,
          companyMemos: INITIAL_MEMOS,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
        setSyncStatus('클라우드 동기화 완료');
      }
    }, (error) => {
      console.error('Firebase DB 연동 오류:', error);
      setSyncStatus('로컬 모드');
    });

    return () => unsubscribe();
  }, []);

  // 클라우드 저장 헬퍼
  const saveToFirestore = async (newMatrix, newComps, newRows, newMemos) => {
    try {
      setSyncStatus('저장 중...');
      await setDoc(docRef, {
        matrixData: newMatrix || matrixData,
        companies: newComps || companies,
        rows: newRows || rows,
        companyMemos: newMemos || companyMemos,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      setSyncStatus('클라우드 연결됨');
    } catch (err) {
      console.error('Firestore 저장 오류:', err);
      setSyncStatus('저장 오류');
    }
  };

  // 셀 수치 수정
  const handleCellChange = (month, rowId, rawValue) => {
    const numericVal = Number(rawValue.replace(/,/g, '')) || 0;

    const newMatrix = {
      ...matrixData,
      [selectedYear]: {
        ...(matrixData[selectedYear] || {}),
        [selectedCompany]: {
          ...(matrixData[selectedYear]?.[selectedCompany] || {}),
          [month]: {
            ...(matrixData[selectedYear]?.[selectedCompany]?.[month] || {}),
            [rowId]: numericVal
          }
        }
      }
    };

    setMatrixData(newMatrix);
    saveToFirestore(newMatrix, null, null, null);
  };

  // 메모 수정
  const handleMemoChange = (comp, text) => {
    const newMemos = {
      ...companyMemos,
      [comp]: text
    };
    setCompanyMemos(newMemos);
    saveToFirestore(null, null, null, newMemos);
  };

  // 회사 추가 / 수정 / 삭제
  const handleAddCompany = (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    const name = newCompanyName.trim();
    if (companies.includes(name)) {
      alert('이미 존재하는 회사명입니다.');
      return;
    }

    const newComps = [...companies, name];
    const newMemos = { ...companyMemos, [name]: '동향 메모를 입력해 주세요.' };
    const newMatrix = { ...matrixData };
    [2025, 2026].forEach((y) => {
      if (!newMatrix[y]) newMatrix[y] = {};
      newMatrix[y][name] = {};
      for (let m = 1; m <= 12; m++) {
        newMatrix[y][name][m] = { revenue: 0, op_profit: 0 };
      }
    });

    setCompanies(newComps);
    setCompanyMemos(newMemos);
    setMatrixData(newMatrix);
    setSelectedCompany(name);
    setNewCompanyName('');

    saveToFirestore(newMatrix, newComps, null, newMemos);
  };

  const handleRenameCompany = (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if (companies.includes(trimmed)) {
      alert('이미 존재하는 회사명입니다.');
      return;
    }

    const newComps = companies.map(c => c === oldName ? trimmed : c);
    if (selectedCompany === oldName) setSelectedCompany(trimmed);

    const newMatrix = { ...matrixData };
    [2025, 2026].forEach(y => {
      if (newMatrix[y] && newMatrix[y][oldName]) {
        newMatrix[y][trimmed] = newMatrix[y][oldName];
        delete newMatrix[y][oldName];
      }
    });

    const newMemos = { ...companyMemos };
    if (newMemos[oldName] !== undefined) {
      newMemos[trimmed] = newMemos[oldName];
      delete newMemos[oldName];
    }

    setCompanies(newComps);
    setMatrixData(newMatrix);
    setCompanyMemos(newMemos);

    saveToFirestore(newMatrix, newComps, null, newMemos);
  };

  const handleDeleteCompany = (compName) => {
    if (companies.length <= 1) {
      alert('최소 한 개의 회사는 존재해야 합니다.');
      return;
    }
    if (window.confirm(`'${compName}' 회사를 삭제하시겠습니까?`)) {
      const nextCompanies = companies.filter((c) => c !== compName);
      setCompanies(nextCompanies);
      if (selectedCompany === compName) setSelectedCompany(nextCompanies[0]);

      saveToFirestore(null, nextCompanies, null, null);
    }
  };

  // 행 추가 / 수정 / 삭제
  const handleAddRow = (e) => {
    e.preventDefault();
    if (!newRowName.trim()) return;

    const newId = `custom_${Date.now()}`;
    const newRowObj = {
      id: newId,
      name: newRowName.trim(),
      calcType: newRowCalcType,
      isPercentage: false,
      isBuiltIn: false
    };

    let newRows = [...rows];
    const marginIndex = rows.findIndex((r) => r.isPercentage);
    if (marginIndex !== -1) {
      newRows.splice(marginIndex, 0, newRowObj);
    } else {
      newRows.push(newRowObj);
    }

    setRows(newRows);
    setNewRowName('');
    setNewRowCalcType('+');
    setIsAddRowModalOpen(false);

    saveToFirestore(null, null, newRows, null);
  };

  const handleSaveRowEdit = () => {
    if (!editingRow) return;
    const newRows = rows.map((r) => (r.id === editingRow.id ? editingRow : r));
    setRows(newRows);
    setEditingRow(null);
    saveToFirestore(null, null, newRows, null);
  };

  const handleDeleteRow = (rowId) => {
    if (window.confirm('이 구분을 삭제하시겠습니까?')) {
      const newRows = rows.filter((r) => r.id !== rowId);
      setRows(newRows);
      setEditingRow(null);
      saveToFirestore(null, null, newRows, null);
    }
  };

  // -------------------------------------------------------------
  // 연산 유틸리티 함수 (수입, 지출합계, 손익, 손익률)
  // -------------------------------------------------------------

  // 소수점 셋째자리에서 반올림하여 둘째자리까지 표시 포맷터
  const formatMargin = (val) => {
    if (!val || isNaN(val) || !isFinite(val)) return '0.00';
    return Number(val).toFixed(2);
  };

  // 1. 월별 수입
  const getMonthlyIncome = (year, comp, month) => {
    const mData = matrixData?.[year]?.[comp]?.[month] || {};
    if (mData['income'] !== undefined) return mData['income'];
    const rev = mData['revenue'] || 0;
    const profit = mData['op_profit'] || 0;
    return rev + profit;
  };

  // 2. 월별 지출합계
  const getMonthlyExpense = (year, comp, month) => {
    const mData = matrixData?.[year]?.[comp]?.[month] || {};
    return mData['revenue'] || 0;
  };

  // 3. 월별 손익 (수입 - 지출합계)
  const getMonthlyProfit = (year, comp, month) => {
    const inc = getMonthlyIncome(year, comp, month);
    const exp = getMonthlyExpense(year, comp, month);
    return inc - exp;
  };

  // 4. 월별 손익률 ((손익 ÷ 수입) × 100, 소수점 2자리 버림)
  const getMonthlyMargin = (year, comp, month) => {
    const inc = getMonthlyIncome(year, comp, month);
    const profit = getMonthlyProfit(year, comp, month);
    if (!inc || inc === 0) return '0.00';
    return formatMargin((profit / inc) * 100);
  };

  // 5. 회사별 연간 수입 합계
  const getYearlyIncome = (year, comp) => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      sum += getMonthlyIncome(year, comp, m);
    }
    return sum;
  };

  // 6. 회사별 연간 지출합계
  const getYearlyExpense = (year, comp) => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      sum += getMonthlyExpense(year, comp, m);
    }
    return sum;
  };

  // 7. 회사별 연간 손익 (수입 - 지출합계)
  const getYearlyProfit = (year, comp) => {
    return getYearlyIncome(year, comp) - getYearlyExpense(year, comp);
  };

  // 8. 회사별 연간 손익률 ((손익 ÷ 수입) × 100, 소수점 2자리 버림)
  const getYearlyMarginSum = (year, comp) => {
    const incSum = getYearlyIncome(year, comp);
    const profitSum = getYearlyProfit(year, comp);
    if (!incSum || incSum === 0) return '0.00';
    return formatMargin((profitSum / incSum) * 100);
  };

  // 9. 전체 그룹 연간 수입 합계
  const getGroupYearlyIncome = (year) => {
    return companies.reduce((acc, c) => acc + getYearlyIncome(year, c), 0);
  };

  // 10. 전체 그룹 연간 지출합계
  const getGroupYearlyExpense = (year) => {
    return companies.reduce((acc, c) => acc + getYearlyExpense(year, c), 0);
  };

  // 11. 전체 그룹 연간 손익 (전체 수입 - 전체 지출합계)
  const getGroupYearlyProfit = (year) => {
    return getGroupYearlyIncome(year) - getGroupYearlyExpense(year);
  };

  // 12. 전체 그룹 연간 손익률 ((전체 손익 ÷ 전체 수입) × 100, 소수점 2자리 버림)
  const getGroupYearlyMarginSum = (year) => {
    const totalInc = getGroupYearlyIncome(year);
    const totalProfit = getGroupYearlyProfit(year);
    if (!totalInc || totalInc === 0) return '0.00';
    return formatMargin((totalProfit / totalInc) * 100);
  };

  // 13. 전체 그룹 월별 수입/지출/손익/손익률
  const getGroupMonthlyIncome = (year, month) => {
    return companies.reduce((acc, c) => acc + getMonthlyIncome(year, c, month), 0);
  };

  const getGroupMonthlyExpense = (year, month) => {
    return companies.reduce((acc, c) => acc + getMonthlyExpense(year, c, month), 0);
  };

  const getGroupMonthlyProfit = (year, month) => {
    return getGroupMonthlyIncome(year, month) - getGroupMonthlyExpense(year, month);
  };

  const getGroupMonthlyMarginSum = (year, month) => {
    const totalInc = getGroupMonthlyIncome(year, month);
    const totalProfit = getGroupMonthlyProfit(year, month);
    if (!totalInc || totalInc === 0) return '0.00';
    return formatMargin((totalProfit / totalInc) * 100);
  };

  // 14. 일반 행 연간 합계
  const getYearlySum = (year, comp, rowId) => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      if (rowId === 'income') sum += getMonthlyIncome(year, comp, m);
      else if (rowId === 'revenue') sum += getMonthlyExpense(year, comp, m);
      else if (rowId === 'op_profit') sum += getMonthlyProfit(year, comp, m);
      else sum += matrixData?.[year]?.[comp]?.[m]?.[rowId] || 0;
    }
    return sum;
  };

  // 15. 일반 행 누적 (YTD) 합계
  const getYTDSum = (year, comp, rowId, targetMonth) => {
    let sum = 0;
    for (let m = 1; m <= targetMonth; m++) {
      if (rowId === 'income') sum += getMonthlyIncome(year, comp, m);
      else if (rowId === 'revenue') sum += getMonthlyExpense(year, comp, m);
      else if (rowId === 'op_profit') sum += getMonthlyProfit(year, comp, m);
      else sum += matrixData?.[year]?.[comp]?.[m]?.[rowId] || 0;
    }
    return sum;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* 1. 상단 GNB 헤더 */}
      <header className="bg-[#0f2432] text-white shadow-md border-b border-slate-700">
        <div className="w-full max-w-full px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-100">
              푸드윈 홀딩스 경영지원실 대시보드
            </h1>
            <p className="text-xs text-sky-200/70 mt-0.5">Copyright © Foodwin Holdings All rights reserved.</p>
          </div>

          <div className="flex items-center gap-5">
            {/* 클라우드 상태 뱃지 */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 text-xs font-black text-emerald-400">
              <Cloud size={16} />
              <span>{syncStatus}</span>
            </div>

            {/* 기준 연도 셀렉터 */}
            <div className="flex items-center gap-3 bg-slate-800 text-sm px-5 py-2.5 rounded-xl border border-slate-600 shadow-sm">
              <Calendar size={18} className="text-sky-400" />
              <span className="text-slate-200 font-bold">기준 연도:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-white text-base font-black focus:outline-none cursor-pointer"
              >
                <option value={2026} className="bg-slate-900">2026년</option>
                <option value={2025} className="bg-slate-900">2025년</option>
              </select>
            </div>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="w-full max-w-full px-8 flex border-t border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-8 py-3.5 text-base font-black border-b-2 transition ${
              activeTab === 'dashboard'
                ? 'border-sky-400 text-sky-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={20} />
            대시보드
          </button>
          <button
            onClick={() => setActiveTab('datamanage')}
            className={`flex items-center gap-2 px-8 py-3.5 text-base font-black border-b-2 transition ${
              activeTab === 'datamanage'
                ? 'border-sky-400 text-sky-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database size={20} />
            데이터관리
          </button>
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <div className="flex-1 w-full max-w-full flex p-8 gap-8">
        
        {/* 좌측 사이드바 (데이터관리 탭 전용) */}
        {activeTab === 'datamanage' && (
          <aside className="w-48 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Building2 size={16} className="text-sky-600" />
                  회사 선택
                </h2>
                <button
                  onClick={() => setIsCompanyModalOpen(true)}
                  className="p-1.5 bg-slate-100 hover:bg-sky-50 hover:text-sky-600 rounded-md text-slate-500 transition"
                  title="회사 관리 및 이름 수정"
                >
                  <Edit3 size={16} />
                </button>
              </div>

              <div className="space-y-1.5">
                {companies.map((comp) => {
                  const isSelected = selectedCompany === comp;
                  return (
                    <button
                      key={comp}
                      onClick={() => setSelectedCompany(comp)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-black transition ${
                        isSelected
                          ? 'bg-sky-900 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{comp}</span>
                      {isSelected && <ChevronRight size={14} className="text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
              <p className="font-bold text-slate-700">선택 회사: <span className="text-sky-600 font-extrabold">{selectedCompany}</span></p>
              <p>수치를 입력 후 저장을 누르면 클라우드에 보관됩니다.</p>
            </div>
          </aside>
        )}

        {/* 메인 콘텐츠 영역 */}
        <main className="flex-1 min-w-0">

          {/* TAB 1: 대시보드 */}
          {activeTab === 'dashboard' && (
            <div className="space-y-10">

              {/* 1. 상단 표: 연간 누적액 총액 지표 */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <span className="inline-block w-3 h-7 bg-sky-700 rounded-sm"></span>
                    {selectedYear}년 (연간 누적액 총액 지표)
                  </h2>
                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-300 px-4 py-1.5 rounded-full shadow-sm">
                    * 전체 회사 연간 실적 집계
                  </span>
                </div>

                <div className="overflow-x-auto shadow-sm rounded-xl border border-slate-300 bg-white">
                  <table className="w-full min-w-[1100px] text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1b587d] text-white text-base font-black whitespace-nowrap">
                        <th className="py-4 px-5 w-48 border-r border-sky-800 whitespace-nowrap">구분</th>
                        {companies.map((comp, idx) => (
                          <th
                            key={comp}
                            className={`py-4 px-5 border-r border-sky-800 text-center whitespace-nowrap min-w-[140px] ${
                              idx % 2 === 1 ? 'bg-[#164a6a]' : ''
                            }`}
                          >
                            {comp}
                          </th>
                        ))}
                        <th className="py-4 px-5 text-center bg-[#154663] whitespace-nowrap min-w-[160px]">합계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {rows.map((row) => {
                        if (row.isPercentage) {
                          return (
                            <tr key={row.id} className="font-black text-base hover:bg-slate-100/50 transition whitespace-nowrap">
                              <td className="py-4 px-5 font-black text-slate-900 border-r border-slate-200 whitespace-nowrap bg-amber-50/30">
                                {row.name}
                              </td>
                              {companies.map((comp, idx) => (
                                <td
                                  key={comp}
                                  className={`py-4 px-5 text-right border-r border-slate-200 tabular-nums font-black text-black text-base whitespace-nowrap min-w-[140px] ${
                                    idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                                  }`}
                                >
                                  {getYearlyMarginSum(selectedYear, comp)}%
                                </td>
                              ))}
                              <td className="py-4 px-5 text-right tabular-nums font-black text-slate-900 bg-[#e2ebf3] text-base whitespace-nowrap min-w-[160px] border-l border-slate-300">
                                {getGroupYearlyMarginSum(selectedYear)}%
                              </td>
                            </tr>
                          );
                        }

                        if (row.isCalculated || row.id === 'op_profit') {
                          const groupProfit = getGroupYearlyProfit(selectedYear);
                          return (
                            <tr key={row.id} className="font-black text-base hover:bg-slate-100/50 transition whitespace-nowrap bg-purple-50/20">
                              <td className="py-4 px-5 font-black text-purple-950 border-r border-slate-200 whitespace-nowrap bg-purple-100/40">
                                {row.name}
                              </td>
                              {companies.map((comp, idx) => {
                                const profit = getYearlyProfit(selectedYear, comp);
                                return (
                                  <td
                                    key={comp}
                                    className={`py-4 px-5 text-right border-r border-slate-200 tabular-nums font-black text-base whitespace-nowrap min-w-[140px] ${
                                      idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                                    }`}
                                  >
                                    <span className={profit >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                                      {profit.toLocaleString()}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="py-4 px-5 text-right tabular-nums font-black text-slate-900 bg-[#e2ebf3] text-lg border-l border-slate-300 whitespace-nowrap min-w-[160px]">
                                <span className={groupProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                                  {groupProfit.toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          );
                        }

                        const compValues = companies.map((c) => {
                          if (row.id === 'income') return getYearlyIncome(selectedYear, c);
                          if (row.id === 'revenue') return getYearlyExpense(selectedYear, c);
                          return getYearlySum(selectedYear, c, row.id);
                        });
                        const totalSum = compValues.reduce((a, b) => a + b, 0);

                        return (
                          <tr key={row.id} className="hover:bg-slate-100/50 transition text-base whitespace-nowrap">
                            <td className="py-4 px-5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap bg-white">
                              {row.name}
                            </td>
                            {companies.map((comp, idx) => (
                              <td
                                key={comp}
                                className={`py-4 px-5 text-right border-r border-slate-200 tabular-nums font-bold text-black text-base whitespace-nowrap min-w-[140px] ${
                                  idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                                }`}
                              >
                                {compValues[idx].toLocaleString()}
                              </td>
                            ))}
                            <td className="py-4 px-5 text-right tabular-nums font-black text-slate-900 bg-[#e2ebf3] text-lg border-l border-slate-300 whitespace-nowrap min-w-[160px]">
                              {totalSum.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 2. 하단 표: 이번달 지표 */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <span className="inline-block w-3 h-7 bg-emerald-600 rounded-sm"></span>
                    {selectedYear}년 {selectedMonth}월 지표
                  </h2>
                  <div className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-xl text-sm font-bold text-slate-800 shadow-sm">
                    <span>조회 월:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="bg-transparent text-sky-900 font-black focus:outline-none cursor-pointer text-base"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{m}월</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto shadow-sm rounded-xl border border-slate-300 bg-white">
                  <table className="w-full min-w-[1100px] text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1b587d] text-white text-base font-black whitespace-nowrap">
                        <th className="py-4 px-5 w-48 border-r border-sky-800 whitespace-nowrap">구분</th>
                        {companies.map((comp, idx) => (
                          <th
                            key={comp}
                            className={`py-4 px-5 border-r border-sky-800 text-center whitespace-nowrap min-w-[140px] ${
                              idx % 2 === 1 ? 'bg-[#164a6a]' : ''
                            }`}
                          >
                            {comp}
                          </th>
                        ))}
                        <th className="py-4 px-5 text-center bg-[#154663] whitespace-nowrap min-w-[160px]">합계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {rows.map((row) => {
                        if (row.isPercentage) {
                          return (
                            <tr key={row.id} className="font-black text-base hover:bg-slate-100/50 transition whitespace-nowrap">
                              <td className="py-4 px-5 font-black text-slate-900 border-r border-slate-200 whitespace-nowrap bg-amber-50/30">
                                {row.name}
                              </td>
                              {companies.map((comp, idx) => (
                                <td
                                  key={comp}
                                  className={`py-4 px-5 text-right border-r border-slate-200 tabular-nums font-black text-black text-base whitespace-nowrap min-w-[140px] ${
                                    idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                                  }`}
                                >
                                  {getMonthlyMargin(selectedYear, comp, selectedMonth)}%
                                </td>
                              ))}
                              <td className="py-4 px-5 text-right tabular-nums font-black text-slate-900 bg-[#e2ebf3] text-base whitespace-nowrap min-w-[160px] border-l border-slate-300">
                                {getGroupMonthlyMarginSum(selectedYear, selectedMonth)}%
                              </td>
                            </tr>
                          );
                        }

                        if (row.isCalculated || row.id === 'op_profit') {
                          const groupProfit = getGroupMonthlyProfit(selectedYear, selectedMonth);
                          return (
                            <tr key={row.id} className="font-black text-base hover:bg-slate-100/50 transition whitespace-nowrap bg-purple-50/20">
                              <td className="py-4 px-5 font-black text-purple-950 border-r border-slate-200 whitespace-nowrap bg-purple-100/40">
                                {row.name}
                              </td>
                              {companies.map((comp, idx) => {
                                const profit = getMonthlyProfit(selectedYear, comp, selectedMonth);
                                return (
                                  <td
                                    key={comp}
                                    className={`py-4 px-5 text-right border-r border-slate-200 tabular-nums font-black text-base whitespace-nowrap min-w-[140px] ${
                                      idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                                    }`}
                                  >
                                    <span className={profit >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                                      {profit.toLocaleString()}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="py-4 px-5 text-right tabular-nums font-black text-slate-900 bg-[#e2ebf3] text-lg border-l border-slate-300 whitespace-nowrap min-w-[160px]">
                                <span className={groupProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                                  {groupProfit.toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          );
                        }

                        const monthCompValues = companies.map((c) => {
                          if (row.id === 'income') return getMonthlyIncome(selectedYear, c, selectedMonth);
                          if (row.id === 'revenue') return getMonthlyExpense(selectedYear, c, selectedMonth);
                          return matrixData?.[selectedYear]?.[c]?.[selectedMonth]?.[row.id] || 0;
                        });
                        const monthTotalSum = monthCompValues.reduce((a, b) => a + b, 0);

                        return (
                          <tr key={row.id} className="hover:bg-slate-100/50 transition text-base whitespace-nowrap">
                            <td className="py-4 px-5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap bg-white">
                              {row.name}
                            </td>
                            {companies.map((comp, idx) => (
                              <td
                                key={comp}
                                className={`py-4 px-5 text-right border-r border-slate-200 tabular-nums font-bold text-black text-base whitespace-nowrap min-w-[140px] ${
                                  idx % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                                }`}
                              >
                                {monthCompValues[idx].toLocaleString()}
                              </td>
                            ))}
                            <td className="py-4 px-5 text-right tabular-nums font-black text-slate-900 bg-[#e2ebf3] text-lg border-l border-slate-300 whitespace-nowrap min-w-[160px]">
                              {monthTotalSum.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 3. 지출합계 상세 분석 파트 (4열 종대 카드 레이아웃) */}
              <section className="space-y-6 pt-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h2 className="text-2xl font-black text-slate-900 border-b-2 border-slate-900 pb-1">
                    지출합계 상세 분석 ({selectedMonth}월)
                  </h2>
                </div>

                <div className="bg-[#0f172a] text-white font-extrabold px-6 py-4 rounded-2xl text-lg shadow-md tracking-wide">
                  푸드윈 홀딩스 그룹
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {companies.map((comp) => {
                    const prevYear = selectedYear - 1;

                    const lastYearMonthRev = matrixData?.[prevYear]?.[comp]?.[selectedMonth]?.['revenue'] || 0;
                    const thisYearMonthRev = matrixData?.[selectedYear]?.[comp]?.[selectedMonth]?.['revenue'] || 0;

                    const lastYearYTDRev = getYTDSum(prevYear, comp, 'revenue', selectedMonth);
                    const thisYearYTDRev = getYTDSum(selectedYear, comp, 'revenue', selectedMonth);

                    const growthRate = lastYearYTDRev > 0
                      ? (((thisYearYTDRev - lastYearYTDRev) / lastYearYTDRev) * 100).toFixed(1)
                      : '0.0';
                    const isPositive = Number(growthRate) >= 0;

                    return (
                      <div key={comp} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
                        {/* 카드 제목 */}
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="text-lg font-black text-slate-900">{comp}</h3>
                        </div>

                        {/* 당월 지출합계 비교 */}
                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                          <span className="inline-block bg-white text-slate-600 border border-slate-300 text-xs font-black px-2.5 py-1 rounded-md shadow-xs">
                            {selectedMonth}월 당월 지출합계
                          </span>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="font-bold">작년 당월</span>
                              <span className="tabular-nums font-bold text-black text-base whitespace-nowrap">
                                {lastYearMonthRev.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-black text-base">
                              <span className="text-slate-900">올해 당월</span>
                              <span className="tabular-nums font-black text-blue-700 text-xl whitespace-nowrap">
                                {thisYearMonthRev.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 누적 지출합계 비교 */}
                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                          <span className="inline-block bg-white text-slate-600 border border-slate-300 text-xs font-black px-2.5 py-1 rounded-md shadow-xs">
                            1~{selectedMonth}월 누적 지출합계
                          </span>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="font-bold">작년 누적</span>
                              <span className="tabular-nums font-bold text-black text-base whitespace-nowrap">
                                {lastYearYTDRev.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-black text-base">
                              <span className="text-slate-900">올해 누적</span>
                              <span className="tabular-nums font-black text-indigo-700 text-xl whitespace-nowrap">
                                {thisYearYTDRev.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 text-xs font-bold">
                              <span className="text-slate-500">성장률 (누적)</span>
                              <span className={`tabular-nums text-sm font-black flex items-center gap-1 whitespace-nowrap ${isPositive ? 'text-rose-600' : 'text-blue-600'}`}>
                                {isPositive ? `▲ ${growthRate}%` : `▼ ${Math.abs(growthRate)}%`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 업체 동향 메모 */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-slate-500">
                            <Pencil size={13} />
                            <span>업체 동향 메모</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5">
                            <textarea
                              rows={2}
                              value={companyMemos[comp] || ''}
                              onChange={(e) => handleMemoChange(comp, e.target.value)}
                              placeholder="동향 및 관련 이슈 메모를 입력하세요..."
                              className="w-full bg-transparent text-xs font-bold text-slate-800 resize-none focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: 데이터관리 (숫자 칸 절대 잘리지 않도록 min-w 및 tabular-nums 설정) */}
          {activeTab === 'datamanage' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Database size={20} className="text-sky-600" />
                    {selectedYear}년 1~12월 지표 데이터 관리
                  </h2>
                  <p className="text-xs text-slate-600 font-bold mt-1">
                    1~12월 수치를 수정한 후 우측 [데이터베이스 저장] 버튼을 누르시면 클라우드에 백업 저장됩니다.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      saveToFirestore(matrixData, companies, rows, companyMemos);
                      alert('클라우드 데이터베이스에 성공적으로 저장되었습니다!');
                    }}
                    className="flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white font-black text-sm px-5 py-3 rounded-xl shadow-sm transition active:scale-95"
                    title="수정한 수치 및 메모를 클라우드 DB에 즉시 저장"
                  >
                    <CloudCheck size={18} />
                    데이터베이스 저장
                  </button>
                </div>
              </div>

              {/* 1~12월 매트릭스 테이블 (잘림 완전 방지: 테이블 최소 너비 2150px 고정, 1~12월 각 150px 고정) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[2150px] w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#154663] text-white font-black border-b border-sky-800 text-base whitespace-nowrap">
                        <th className="py-4 px-4 min-w-[180px] w-[180px] border-r border-sky-800 whitespace-nowrap">구분 (항목)</th>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <th key={m} className="py-4 px-3 min-w-[150px] w-[150px] border-r border-sky-800 text-center whitespace-nowrap">
                            {m}월
                          </th>
                        ))}
                        <th className="py-4 px-4 text-center bg-[#0d2f44] min-w-[180px] w-[180px] whitespace-nowrap">연간 누적</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-bold">
                      {rows.map((row) => {
                        if (row.isPercentage) {
                          const yearlyMarginSum = getYearlyMarginSum(selectedYear, selectedCompany);
                          return (
                            <tr key={row.id} className="bg-amber-50/40 font-black hover:bg-amber-100/40 transition text-base whitespace-nowrap">
                              <td
                                onClick={() => setEditingRow(row)}
                                className="py-4 px-4 text-slate-900 border-r border-slate-200 cursor-pointer hover:text-sky-600 hover:bg-sky-50 transition min-w-[180px] w-[180px] whitespace-nowrap"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{row.name}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded font-mono font-black shrink-0 bg-amber-100 text-amber-800">%</span>
                                </div>
                              </td>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <td key={m} className="py-4 px-3 text-right border-r border-slate-200 tabular-nums text-black font-black bg-amber-50/20 text-base min-w-[150px] w-[150px] whitespace-nowrap">
                                  {getMonthlyMargin(selectedYear, selectedCompany, m)}%
                                </td>
                              ))}
                              <td className="py-4 px-4 text-right tabular-nums font-black text-amber-950 bg-amber-100/70 text-base min-w-[180px] w-[180px] whitespace-nowrap">
                                {yearlyMarginSum}%
                              </td>
                            </tr>
                          );
                        }

                        if (row.isCalculated || row.id === 'op_profit') {
                          const yearlyProfit = getYearlyProfit(selectedYear, selectedCompany);
                          return (
                            <tr key={row.id} className="bg-purple-50/50 font-black hover:bg-purple-100/50 transition text-base whitespace-nowrap">
                              <td
                                onClick={() => setEditingRow(row)}
                                className="py-4 px-4 text-slate-900 border-r border-slate-200 cursor-pointer hover:text-sky-600 hover:bg-sky-50 transition min-w-[180px] w-[180px] whitespace-nowrap"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{row.name}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded font-mono font-black shrink-0 bg-purple-100 text-purple-800">계산</span>
                                </div>
                              </td>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                                const profitVal = getMonthlyProfit(selectedYear, selectedCompany, m);
                                return (
                                  <td key={m} className="py-4 px-3 text-right border-r border-slate-200 tabular-nums font-black text-base bg-purple-50/30 min-w-[150px] w-[150px] whitespace-nowrap">
                                    <span className={profitVal >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                                      {profitVal.toLocaleString()}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="py-4 px-4 text-right tabular-nums font-black text-purple-950 bg-purple-100/70 text-base min-w-[180px] w-[180px] whitespace-nowrap">
                                <span className={yearlyProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                                  {yearlyProfit.toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          );
                        }

                        let yearlyTotalSum = 0;
                        if (row.id === 'income') yearlyTotalSum = getYearlyIncome(selectedYear, selectedCompany);
                        else if (row.id === 'revenue') yearlyTotalSum = getYearlyExpense(selectedYear, selectedCompany);
                        else yearlyTotalSum = getYearlySum(selectedYear, selectedCompany, row.id);

                        return (
                          <tr key={row.id} className="hover:bg-slate-50 transition text-base whitespace-nowrap">
                            <td
                              onClick={() => setEditingRow(row)}
                              className="py-3 px-4 border-r border-slate-200 font-black text-slate-900 cursor-pointer hover:text-sky-600 hover:bg-sky-50 transition group/row min-w-[180px] w-[180px] whitespace-nowrap"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{row.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-black shrink-0 ${row.calcType === '-' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-800'}`}>
                                  {row.calcType === '-' ? '-' : '+'}
                                </span>
                              </div>
                            </td>

                            {/* 1~12월 숫자 입력 칸 (150px 확정 고정, whitespace-nowrap 및 min-w-0으로 잘림 100% 원천 차단) */}
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                              const cellVal = matrixData?.[selectedYear]?.[selectedCompany]?.[m]?.[row.id] ?? '';
                              return (
                                <td key={m} className="py-2 px-1 border-r border-slate-200 min-w-[150px] w-[150px] whitespace-nowrap">
                                  <input
                                    type="text"
                                    value={cellVal !== '' ? Number(cellVal).toLocaleString() : ''}
                                    onChange={(e) => handleCellChange(m, row.id, e.target.value)}
                                    className="w-full min-w-0 text-right tabular-nums font-black text-black bg-transparent px-2 py-1.5 border border-transparent hover:border-slate-300 focus:border-sky-600 focus:bg-white focus:outline-none rounded transition text-base tracking-tight whitespace-nowrap"
                                    placeholder="0"
                                  />
                                </td>
                              );
                            })}

                            <td className="py-3 px-4 text-right tabular-nums font-black text-black bg-slate-100 text-base border-l border-slate-300 min-w-[180px] w-[180px] whitespace-nowrap">
                              {yearlyTotalSum.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => setIsAddRowModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-black text-white bg-sky-700 hover:bg-sky-800 px-5 py-2.5 rounded-lg transition shadow-sm"
                  >
                    <Plus size={16} /> 구분 추가
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 모달 1: 회사 관리 */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-sky-600" />
                회사 관리 (이름 수정 & 추가 / 삭제)
              </h3>
              <button onClick={() => setIsCompanyModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">신규 회사 등록</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="새 회사 이름 입력"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  required
                />
                <button type="submit" className="bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition shrink-0">
                  추가
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-2">등록 회사 목록</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {companies.map((comp) => (
                  <div key={comp} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-bold">
                    {editingCompOldName === comp ? (
                      <div className="flex items-center gap-1.5 flex-1 mr-2">
                        <input
                          type="text"
                          value={tempCompName}
                          onChange={(e) => setTempCompName(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-sky-400 rounded focus:outline-none bg-white text-slate-900"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleRenameCompany(comp, tempCompName);
                            setEditingCompOldName(null);
                          }}
                          className="bg-sky-600 text-white px-2 py-1 rounded text-[11px] font-bold hover:bg-sky-700"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCompOldName(null)}
                          className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[11px] font-bold hover:bg-slate-300"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-slate-800">{comp}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCompOldName(comp);
                              setTempCompName(comp);
                            }}
                            className="text-slate-400 hover:text-sky-600 transition p-1"
                            title="회사 이름 수정"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCompany(comp)}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                            title="회사 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setIsCompanyModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 구분 추가 */}
      {isAddRowModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-sky-600" />
                구분 추가
              </h3>
              <button onClick={() => setIsAddRowModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRow} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">구분 이름</label>
                <input
                  type="text"
                  placeholder="항목 이름 입력"
                  value={newRowName}
                  onChange={(e) => setNewRowName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">지표 반영 유형</label>
                <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setNewRowCalcType('+')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${newRowCalcType === '+' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600'}`}
                  >
                    + 플러스 (가산)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRowCalcType('-')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${newRowCalcType === '-' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'}`}
                  >
                    - 마이너스 (차감)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setIsAddRowModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                  취소
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg">
                  구분 생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 3: 구분 편집 */}
      {editingRow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Settings size={18} className="text-sky-600" />
                구분 설정
              </h3>
              <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">구분 이름</label>
                <input
                  type="text"
                  value={editingRow.name}
                  onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {!editingRow.isPercentage && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">지표 반영 유형</label>
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingRow({ ...editingRow, calcType: '+' })}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${editingRow.calcType === '+' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600'}`}
                    >
                      + 플러스 (가산)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRow({ ...editingRow, calcType: '-' })}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${editingRow.calcType === '-' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'}`}
                    >
                      - 마이너스 (차감)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              {!editingRow.isBuiltIn ? (
                <button type="button" onClick={() => handleDeleteRow(editingRow.id)} className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg">
                  삭제
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                  취소
                </button>
                <button type="button" onClick={handleSaveRowEdit} className="px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg">
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto text-center text-xs text-slate-400">
        © 2026 푸드윈 홀딩스 경영지원실 (FoodWin Holdings). All rights reserved.
      </footer>
    </div>
  );
}
