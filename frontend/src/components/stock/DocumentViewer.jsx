import React, { useState, useRef } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';

const DocumentViewer = ({ fileSummaries = [], activeTheme }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const currentFile = fileSummaries[activeFileIndex] || fileSummaries[0] || null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleMouseDown = (e) => {
    if (zoomLevel <= 1 && rotation === 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          {currentFile?.fileType === 'IMAGE' ? (
            <ImageIcon className="w-4 h-4 text-emerald-600" />
          ) : currentFile?.fileType === 'SPREADSHEET' ? (
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
          ) : (
            <FileText className="w-4 h-4 text-rose-600" />
          )}
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px] sm:max-w-xs" title={currentFile?.fileName}>
            {currentFile?.fileName || 'Uploaded Document'}
          </span>
          {fileSummaries.length > 1 && (
            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              {activeFileIndex + 1} of {fileSummaries.length}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {fileSummaries.length > 1 && (
            <div className="flex items-center mr-2 border-r border-slate-200 pr-2">
              <button
                type="button"
                onClick={() => {
                  setActiveFileIndex(prev => (prev > 0 ? prev - 1 : fileSummaries.length - 1));
                  handleResetZoom();
                }}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                title="Previous Document"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFileIndex(prev => (prev < fileSummaries.length - 1 ? prev + 1 : 0));
                  handleResetZoom();
                }}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                title="Next Document"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {currentFile?.previewUrl && (
            <>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-slate-600 w-9 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3.5}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                title="Rotate 90° Clockwise"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                title="Fit to Width / Reset"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div 
        className="relative flex-1 min-h-[280px] sm:min-h-[360px] max-h-[460px] overflow-hidden bg-slate-900/5 flex items-center justify-center p-2 select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'default' }}
      >
        {currentFile?.previewUrl ? (
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="flex items-center justify-center max-w-full max-h-full"
          >
            <img
              src={currentFile.previewUrl}
              alt={currentFile.fileName}
              className="max-h-[420px] w-auto object-contain rounded-lg shadow-md border border-slate-200 pointer-events-none"
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md bg-white rounded-xl border border-slate-200 shadow-xs">
            {currentFile?.fileType === 'SPREADSHEET' ? (
              <FileSpreadsheet className="w-12 h-12 text-teal-600 mb-3" />
            ) : (
              <FileText className="w-12 h-12 text-rose-600 mb-3" />
            )}
            <h4 className="text-sm font-bold text-slate-800 mb-1">
              {currentFile?.fileName || 'Extracted Document'}
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {currentFile?.rowCount ? `${currentFile.rowCount} rows extracted from this file.` : 'Data ready for verification.'}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 text-left">
              <Info className="w-3.5 h-3.5 shrink-0 text-sky-500" />
              <span>Review, edit, and confirm the extracted values in the verification table on the right.</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Hint Strip */}
      <div className="px-3 py-1.5 bg-white border-t border-slate-200 text-[10px] text-slate-600 flex items-center justify-between">
        <span>Click and drag to pan zoomed documents</span>
        <span className="font-mono text-slate-600">
          {currentFile?.fileType} • {(currentFile?.fileSize ? (currentFile.fileSize / 1024).toFixed(1) + ' KB' : '')}
        </span>
      </div>
    </div>
  );
};

export default DocumentViewer;
