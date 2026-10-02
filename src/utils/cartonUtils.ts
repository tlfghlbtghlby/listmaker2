// Helper utility for Carton & Pieces calculation and Arabic formatting

export interface CartonBreakdown {
  cartons: number;
  remainingPieces: number;
  totalPieces: number;
  piecesPerCarton: number;
  formatted: string;
  shortLabel: string;
}

/**
 * Calculates cartons and remaining pieces from total pieces
 * Example: 30 pieces with 6 per carton -> 5 cartons, 0 pieces
 * Example: 18 pieces with 6 per carton -> 3 cartons, 0 pieces
 * Example: 13 pieces with 6 per carton -> 2 cartons and 1 piece
 * Example: 7 pieces with 6 per carton -> 1 carton and 1 piece
 */
export function getCartonBreakdown(totalPieces: number, piecesPerCarton?: number): CartonBreakdown {
  const ppc = piecesPerCarton && piecesPerCarton > 1 ? Math.floor(piecesPerCarton) : 1;
  const safeTotal = Math.max(0, Math.floor(totalPieces || 0));

  if (ppc <= 1) {
    const formatted = safeTotal === 0 
      ? 'نفد من المخزن (0)' 
      : `${safeTotal} قطعة`;
    return {
      cartons: 0,
      remainingPieces: safeTotal,
      totalPieces: safeTotal,
      piecesPerCarton: 1,
      formatted,
      shortLabel: formatted,
    };
  }

  const cartons = Math.floor(safeTotal / ppc);
  const remainingPieces = safeTotal % ppc;

  // Format Arabic description without cutting off words
  let formatted = '';
  let shortLabel = '';

  if (safeTotal === 0) {
    formatted = 'نفد من المخزن (0)';
    shortLabel = '0 كارتون';
  } else if (cartons > 0 && remainingPieces === 0) {
    const cartonWord = cartons === 1 ? 'كارتون واحد' : cartons === 2 ? 'كرتونان' : cartons <= 10 ? `${cartons} كراتين` : `${cartons} كارتون`;
    formatted = `${cartonWord} (إجمالي ${safeTotal} قطعة)`;
    shortLabel = cartonWord;
  } else if (cartons === 0 && remainingPieces > 0) {
    const pieceWord = remainingPieces === 1 ? 'قطعة واحدة' : remainingPieces === 2 ? 'قطعتان' : remainingPieces <= 10 ? `${remainingPieces} قطع` : `${remainingPieces} قطعة`;
    formatted = pieceWord;
    shortLabel = pieceWord;
  } else {
    // Both cartons and pieces
    const cartonWord = cartons === 1 ? 'كارتون واحد' : cartons === 2 ? 'كرتونان' : cartons <= 10 ? `${cartons} كراتين` : `${cartons} كارتون`;
    const pieceWord = remainingPieces === 1 ? 'قطعة واحدة' : remainingPieces === 2 ? 'قطعتان' : remainingPieces <= 10 ? `${remainingPieces} قطع` : `${remainingPieces} قطعة`;
    formatted = `${cartonWord} و ${pieceWord} (إجمالي ${safeTotal} قطعة)`;
    shortLabel = `${cartonWord} و ${pieceWord}`;
  }

  return {
    cartons,
    remainingPieces,
    totalPieces: safeTotal,
    piecesPerCarton: ppc,
    formatted,
    shortLabel,
  };
}

/**
 * Calculates stock after selling a quantity of pieces or cartons
 */
export function calculateNewStock(
  currentTotalPieces: number,
  quantitySold: number,
  unitType: 'piece' | 'carton' = 'piece',
  piecesPerCarton: number = 1
): number {
  const ppc = piecesPerCarton > 1 ? piecesPerCarton : 1;
  const piecesToDeduct = unitType === 'carton' ? quantitySold * ppc : quantitySold;
  return Math.max(0, currentTotalPieces - piecesToDeduct);
}
