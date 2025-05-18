'use client';

import React, { useState } from 'react';
import { Box, Menu, MenuItem, Modal, TextField, Button } from '@mui/material';
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

  function markCutNodes(node: NodeItem): NodeItem {
    return {
      ...node,
      isCut: true,
      children: node.children.map(markCutNodes),
    };
  }

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

    for (const node of tree) {
      const [childrenWithLayout, nextRow] = recalculateLayout(node.children, row, col + 1);
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

  function replaceNodeInTree(nodes: NodeItem[], targetId: string, updatedNode: NodeItem): NodeItem[] {
    return nodes.map(node => {
      if (node.id === targetId) {
        return updatedNode;
      }
      if (node.children.length > 0) {
        return {
          ...node,
          children: replaceNodeInTree(node.children, targetId, updatedNode),
        };
      }
      return node;
    });
  }

  const handleCut = () => {
    if (!contextNode) return;
    if (contextNode.id === 'root') return;

    const cutNodeMarked = markCutNodes(contextNode);

    setNodes(prevNodes => replaceNodeInTree(prevNodes, cutNodeMarked.id, cutNodeMarked));

    setClipboard({ mode: 'cut', node: cutNodeMarked });
    setContextMenu(null);
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

  const clearCutFlags = (node: NodeItem): NodeItem => ({
    ...node,
    isCut: false,
    children: node.children.map(clearCutFlags),
  });

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

    let updatedTree = nodes;

    if (clipboard.mode === 'cut') {
      updatedTree = removeFrom(updatedTree);
    }

    const nodeToPaste =
      clipboard.mode === 'copy'
        ? deepClone(clipboard.node)
        : clearCutFlags(clipboard.node);

    updatedTree = updateTree(updatedTree, contextNode.id, (n) => {
      n.children = [...n.children, nodeToPaste];
    });

    const [recalculated] = recalculateLayout(updatedTree);
    setNodes(recalculated);
    setClipboard(null);
    handleCloseContextMenu();
  };


  const renderConnectors = () => {
    const flatNodes = flattenTree(nodes);

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          overflow: 'visible',
          zIndex: 0,
          transform: 'scaleX(-1)'
        }}
      >
        {flatNodes.map((child) => {
          if (!child.parentId) return null;
          const parent = flatNodes.find(n => n.id === child.parentId);
          if (!parent) return null;

          const parentX = parent.col * COLUMN_SPACING + NODE_WIDTH;
          const childX = child.col * COLUMN_SPACING;

          const VERTICAL_OFFSET = 48;

          const parentY = parent.row * ROW_SPACING + NODE_HEIGHT / 2 + VERTICAL_OFFSET;
          const childY = child.row * ROW_SPACING + NODE_HEIGHT / 2 + VERTICAL_OFFSET;

          const horizontalGap = 20;

          const points = [
            [parentX, parentY],
            [parentX + horizontalGap, parentY],
            [parentX + horizontalGap, childY],
            [childX, childY],
          ]
            .map(point => point.join(','))
            .join(' ');

          return (
            <polyline
              key={child.id}
              points={points}
              fill="none"
              stroke={'#B3B3B3'}
              strokeWidth={2}
            />
          );
        })}
      </svg>
    );
  };




  const removeFrom = (list: NodeItem[]): NodeItem[] => {
    return list
      .filter((n) => n.id !== clipboard?.node.id)
      .map((n) => ({ ...n, children: removeFrom(n.children) }));
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
          position={"relative"}
          className={`rounded-xl border-[2px] border-[#C48484] px-4 py-2 shadow-md cursor-pointer hover:shadow-lg`}
          sx={{
            zIndex: 2,
            backgroundColor: node.id === 'root' ? '#C48484' : 'white',
            opacity: node.isCut ? 0.1 : 1, direction: 'rtl', width: NODE_WIDTH, height: NODE_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
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
        <MenuItem onClick={handleDelete} disabled={
          !contextNode ||
          contextNode.id === 'root' ||
          (contextNode.children && contextNode.children.length > 0)
        }>حذف</MenuItem>
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
            <Button variant="contained" onClick={handleModalSubmit}>افزودن</Button>
            <Button variant="outlined" onClick={() => setModalOpen(false)}>لغو</Button>
          </div>
        </Box>
      </Modal>
    </div>
  );
}
