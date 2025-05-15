'use client';

import React, { useState, useMemo } from 'react';
import { Box, Menu, MenuItem, Modal, TextField, Button, useTheme } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';

interface NodeItem {
  id: string;
  label: string;
  children: NodeItem[];
  parentId?: string;
  isCut?: boolean;
  col: number;
  row: number;
}

const COLUMN_SPACING = 250;
const ROW_SPACING = 100;
const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const RootLabel = 'حساب‌های اصلی';

export default function NodeTreeEditor() {
  const theme = useTheme();

  const [nodes, setNodes] = useState<NodeItem[]>([{
    id: 'root',
    label: RootLabel,
    children: [],
    col: 0,
    row: 0,
  }]);

  const [contextNode, setContextNode] = useState<NodeItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ top: number; left: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [clipboard, setClipboard] = useState<{ mode: 'cut' | 'copy'; node: NodeItem } | null>(null);

  const handleAddChild = () => {
    setModalOpen(true);
    handleCloseContextMenu();
  };

  const handleRightClick = (event: React.MouseEvent, node: NodeItem) => {
    event.preventDefault();
    setContextNode(node);
    setContextMenu({ left: event.clientX, top: event.clientY });
  };

  const handleCloseContextMenu = () => setContextMenu(null);

  const flattenTree = (tree: NodeItem[]): NodeItem[] => {
    const list: NodeItem[] = [];
    const walk = (node: NodeItem) => {
      list.push(node);
      node.children.forEach(walk);
    };
    tree.forEach(walk);
    return list;
  };

  const updateTree = (current: NodeItem[], id: string, updater: (n: NodeItem) => void): NodeItem[] => {
    return current.map((node) => {
      if (node.id === id) {
        const updated = { ...node };
        updater(updated);
        return updated;
      } else if (node.children.length) {
        return { ...node, children: updateTree(node.children, id, updater) };
      }
      return node;
    });
  };

  const recalculateLayout = (tree: NodeItem[], startRow = 0, col = 0): [NodeItem[], number] => {
    let row = startRow;
    const updated: NodeItem[] = [];

    for (let node of tree) {
      const [childrenWithLayout, nextRow] = recalculateLayout(node.children, row + 1, col + 1);
      const nodeWithLayout = { ...node, col, row, children: childrenWithLayout };
      updated.push(nodeWithLayout);
      row = Math.max(row + 1, nextRow);
    }

    return [updated, row];
  };

  const handleModalSubmit = () => {
    if (!contextNode || !newLabel.trim()) return;

    const newChild: NodeItem = {
      id: uuidv4(),
      label: newLabel,
      children: [],
      parentId: contextNode.id,
      col: 0,
      row: 0,
    };

    const updatedTree = updateTree(nodes, contextNode.id, (n) => {
      n.children = [...n.children, newChild];
    });

    const [recalculated] = recalculateLayout(updatedTree);
    setNodes(recalculated);
    setNewLabel('');
    setModalOpen(false);
  };

  const handleCut = () => {
    if (!contextNode || contextNode.id === 'root') return;
    setClipboard({ mode: 'cut', node: contextNode });
    const updated = updateTree(nodes, contextNode.id, (n) => (n.isCut = true));
    setNodes(updated);
    handleCloseContextMenu();
  };

  const handleCopy = () => {
    if (!contextNode || contextNode.id === 'root') return;
    setClipboard({ mode: 'copy', node: contextNode });
    handleCloseContextMenu();
  };

  const handleDelete = () => {
    const deleteFrom = (list: NodeItem[]): NodeItem[] => {
      return list
        .filter((n) => n.id !== contextNode?.id)
        .map((n) => ({ ...n, children: deleteFrom(n.children) }));
    };
    const cleaned = deleteFrom(nodes);
    const [recalculated] = recalculateLayout(cleaned);
    setNodes(recalculated);
    handleCloseContextMenu();
  };

  const handlePaste = () => {
    if (!contextNode || !clipboard || contextNode.id === clipboard.node.id) return;

    const deepClone = (node: NodeItem): NodeItem => ({
      ...node,
      id: uuidv4(),
      isCut: false,
      col: 0,
      row: 0,
      children: node.children.map(deepClone),
    });

    const pastedNode = clipboard.mode === 'copy' ? deepClone(clipboard.node) : clipboard.node;
    const updated = updateTree(nodes, contextNode.id, (n) => n.children.push(pastedNode));

    const removeFrom = (list: NodeItem[]): NodeItem[] => {
      return list
        .filter((n) => n.id !== clipboard.node.id)
        .map((n) => ({ ...n, children: removeFrom(n.children) }));
    };

    const nextTree = clipboard.mode === 'cut' ? removeFrom(updated) : updated;
    setClipboard(null);
    const [recalculated] = recalculateLayout(nextTree);
    setNodes(recalculated);
    handleCloseContextMenu();
  };

  const nodesById = useMemo(() => Object.fromEntries(flattenTree(nodes).map(n => [n.id, n])), [nodes]);

  const renderConnectors = () => {
    return flattenTree(nodes).map((child) => {
      if (!child.parentId) return null;
      const parent = nodesById[child.parentId];
      if (!parent) return null;

      const parentMidY = parent.row * ROW_SPACING + NODE_HEIGHT / 2;
      const childMidY = child.row * ROW_SPACING + NODE_HEIGHT / 2;
      const parentAnchorX = parent.col * COLUMN_SPACING + NODE_WIDTH;
      const childAnchorX = child.col * COLUMN_SPACING;

      const dx = childAnchorX - parentAnchorX;
      const dy = childMidY - parentMidY;
      const svgTop = Math.min(parentMidY, childMidY) - 20;
      const svgHeight = Math.abs(dy) + 40;
      const svgWidth = Math.abs(dx);

      const pathData = `M ${svgWidth},${parentMidY - svgTop} C ${svgWidth * 0.5},${parentMidY - svgTop} ${svgWidth * 0.5},${childMidY - svgTop} 0,${childMidY - svgTop}`;

      return (
        <svg
          key={`link-${child.id}`}
          style={{
            position: 'absolute',
            top: svgTop,
            right: parentAnchorX,
            width: svgWidth,
            height: svgHeight,
            overflow: 'visible',
            pointerEvents: 'none',
            zIndex: 0
          }}
        >
          <path d={pathData} fill="none" stroke={theme.palette.divider} strokeWidth={2} />
        </svg>
      );
    });
  };

  const renderNodes = () => {
    return flattenTree(nodes).map((node) => (
      <div
        key={node.id}
        onContextMenu={(e) => handleRightClick(e, node)}
        className="absolute"
        style={{ right: `${node.col * COLUMN_SPACING}px`, top: `${node.row * ROW_SPACING + 50}px`, zIndex: 1 }}
      >
        <Box
          className={`rounded-xl border border-gray-300 px-4 py-2 shadow-md cursor-pointer hover:shadow-lg bg-white ${node.isCut ? 'opacity-70' : ''}`}
          sx={{ width: NODE_WIDTH, height: NODE_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span className="font-semibold whitespace-nowrap">{node.label}</span>
        </Box>
      </div>
    ));
  };

  return (
    <div className="relative min-h-screen overflow-auto rtl text-right">
      {renderConnectors()}
      {renderNodes()}

      <Menu
        open={!!contextMenu}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ?? undefined}
      >
        <MenuItem onClick={handleCut}>برش</MenuItem>
        <MenuItem onClick={handleCopy}>کپی</MenuItem>
        <MenuItem onClick={handlePaste} disabled={!clipboard}>چسباندن</MenuItem>
        <MenuItem onClick={handleDelete}>حذف</MenuItem>
        <MenuItem onClick={handleAddChild}>افزودن فرزند</MenuItem>
      </Menu>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <Box className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl w-[300px] shadow-xl">
          <TextField
            fullWidth
            label="عنوان گره جدید"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            inputProps={{ dir: 'rtl' }}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outlined" onClick={() => setModalOpen(false)}>لغو</Button>
            <Button variant="contained" onClick={handleModalSubmit}>افزودن</Button>
          </div>
        </Box>
      </Modal>
    </div>
  );
}
