
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Users, Network, Eye, EyeOff, UserPlus } from 'lucide-react';
import { PyramidLevelControls } from './genealogy/PyramidLevelControls';
import { NetworkMetrics } from './genealogy/NetworkMetrics';
import { CompactGenealogyNode } from './genealogy/CompactGenealogyNode';
import { StandbyPanel } from './genealogy/StandbyPanel';
import { useContacts } from '@/hooks/useContacts';
import { useCells } from '@/hooks/useCells';

interface MemberNode {
  id: string;
  name: string;
  leader: string;
  cell: string;
  status: string;
  referredBy: string | null;
  referrals: string[];
  whatsapp?: string | null;
  neighborhood?: string;
  baptized: boolean;
  encounterWithGod: boolean;
  level: number;
  totalDescendants: number;
  photo_url: string | null;
}

interface CustomNodeData extends Record<string, unknown> {
  member: MemberNode;
  isExpanded: boolean;
  onToggleExpansion: (nodeId: string) => void;
}

const nodeTypes = {
  compactGenealogyNode: CompactGenealogyNode,
};

export const GenealogyNetwork = () => {
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [visibleLevels, setVisibleLevels] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));
  const [focusedLevel, setFocusedLevel] = useState<number | null>(null);
  const [showStandby, setShowStandby] = useState(false);
  
  const { contacts, loading: contactsLoading } = useContacts();
  const { cells, loading: cellsLoading } = useCells();

  // Processar dados dos contatos em estrutura hierárquica
  const { connectedMembers, standbyMembers } = useMemo(() => {
    if (contactsLoading || cellsLoading || !contacts.length) {
      return { connectedMembers: [], standbyMembers: [] };
    }

    const cellsMap = new Map(cells.map(cell => [cell.id, cell]));

    // Transformar contatos em membros
    const allMembers: MemberNode[] = contacts.map(contact => {
      const cell = contact.cell_id ? cellsMap.get(contact.cell_id) : null;
      
      return {
        id: contact.id,
        name: contact.name,
        leader: cell?.leader_name || 'Sem líder',
        cell: cell?.name || 'Sem célula',
        status: contact.status,
        referredBy: contact.referred_by || null,
        referrals: [],
        whatsapp: contact.whatsapp,
        neighborhood: contact.neighborhood,
        baptized: contact.baptized || false,
        encounterWithGod: contact.encounter_with_god || false,
        level: 0,
        totalDescendants: 0,
        photo_url: contact.photo_url || null
      };
    });

    // Preencher referrals e calcular níveis
    allMembers.forEach(member => {
      member.referrals = allMembers
        .filter(m => m.referredBy === member.id)
        .map(m => m.id);
      
      member.level = calculateMemberLevel(member.id, allMembers);
      member.totalDescendants = calculateTotalDescendants(member.id, allMembers);
    });

    // Separar membros conectados dos em standby
    const connected = allMembers.filter(member => 
      member.referredBy || member.referrals.length > 0
    );
    
    const standby = allMembers.filter(member => 
      !member.referredBy && member.referrals.length === 0
    );

    return { connectedMembers: connected, standbyMembers: standby };
  }, [contacts, cells, contactsLoading, cellsLoading]);

  const toggleNodeExpansionCallback = useCallback((nodeId: string) => {
    const member = connectedMembers.find(m => m.id === nodeId);
    if (member && member.referrals.length > 0) {
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (prev.has(nodeId)) {
          newSet.delete(nodeId);
        } else {
          newSet.add(nodeId);
        }
        return newSet;
      });
    }
  }, [connectedMembers]);

  // Inicializar com nós raiz expandidos
  useEffect(() => {
    if (connectedMembers.length > 0) {
      const rootMembers = connectedMembers.filter(m => !m.referredBy);
      setExpandedNodes(new Set(rootMembers.slice(0, 3).map(m => m.id)));
    }
  }, [connectedMembers]);

  // Calcular métricas por nível
  const levelMetrics = useMemo(() => {
    const metrics: { [level: number]: { count: number; baptized: number; withEncounter: number } } = {};
    
    connectedMembers.forEach(member => {
      if (!metrics[member.level]) {
        metrics[member.level] = { count: 0, baptized: 0, withEncounter: 0 };
      }
      metrics[member.level].count++;
      if (member.baptized) metrics[member.level].baptized++;
      if (member.encounterWithGod) metrics[member.level].withEncounter++;
    });
    
    return metrics;
  }, [connectedMembers]);

  // Gerar nós e arestas da rede - Layout mais compacto
  const { nodes, edges } = useMemo(() => {
    if (!connectedMembers.length) return { nodes: [], edges: [] };

    // Filtrar membros por níveis visíveis e nós expandidos
    const visibleMembers = connectedMembers.filter(member => {
      const shouldShowByLevel = visibleLevels.has(member.level);
      const shouldShowByExpansion = member.level === 0 || 
        expandedNodes.has(member.id) || 
        (member.referredBy && expandedNodes.has(member.referredBy));
      
      if (focusedLevel !== null) {
        return member.level === focusedLevel;
      }
      
      return shouldShowByLevel && shouldShowByExpansion;
    });

    const nodes: Node[] = visibleMembers.map((member) => {
      const position = calculateCompactPosition(member, visibleMembers);
      const isExpanded = expandedNodes.has(member.id);
      
      return {
        id: member.id,
        type: 'compactGenealogyNode',
        position,
        data: {
          member,
          isExpanded,
          onToggleExpansion: toggleNodeExpansionCallback
        } satisfies CustomNodeData,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
          zIndex: 1000 - member.level,
        }
      };
    });

    const edges: Edge[] = [];
    visibleMembers.forEach(member => {
      if (member.referredBy && visibleMembers.find(m => m.id === member.referredBy)) {
        edges.push({
          id: `${member.referredBy}-${member.id}`,
          source: member.referredBy,
          target: member.id,
          type: 'smoothstep',
          animated: false,
          style: { 
            strokeWidth: 2, 
            stroke: getLevelColor(member.level),
            opacity: focusedLevel !== null ? (member.level === focusedLevel ? 1 : 0.3) : 1
          },
        });
      }
    });

    return { nodes, edges };
  }, [connectedMembers, expandedNodes, visibleLevels, focusedLevel, toggleNodeExpansionCallback]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const toggleLevel = (level: number) => {
    setVisibleLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  const focusOnLevel = (level: number | null) => {
    setFocusedLevel(level);
    if (level !== null) {
      const levelMembers = connectedMembers.filter(m => m.level === level);
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        levelMembers.forEach(member => {
          newSet.add(member.id);
          if (member.referredBy) newSet.add(member.referredBy);
        });
        return newSet;
      });
    }
  };

  React.useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const nodeData = node.data as CustomNodeData;
    nodeData.onToggleExpansion(node.id);
  }, []);

  if (contactsLoading || cellsLoading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando rede de genealogia...</p>
        </div>
      </div>
    );
  }

  if (!connectedMembers.length && !standbyMembers.length) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum membro encontrado para a rede de genealogia.</p>
          <p className="text-sm text-gray-500 mt-2">
            Adicione contatos para visualizar a rede de discipulado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] relative border rounded-lg overflow-hidden">
      {/* Controles superiores compactos */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMiniMap(!showMiniMap)}
          className="bg-white/95 backdrop-blur-sm shadow-sm text-xs h-7"
        >
          {showMiniMap ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
          Mapa
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandedNodes(new Set(connectedMembers.map(m => m.id)))}
          className="bg-white/95 backdrop-blur-sm shadow-sm text-xs h-7"
        >
          <Network className="w-3 h-3 mr-1" />
          Expandir
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const rootMembers = connectedMembers.filter(m => !m.referredBy);
            setExpandedNodes(new Set(rootMembers.map(m => m.id)));
          }}
          className="bg-white/95 backdrop-blur-sm shadow-sm text-xs h-7"
        >
          <Users className="w-3 h-3 mr-1" />
          Colapsar
        </Button>

        <Button
          variant={showStandby ? "default" : "outline"}
          size="sm"
          onClick={() => setShowStandby(!showStandby)}
          className="bg-white/95 backdrop-blur-sm shadow-sm text-xs h-7"
        >
          <UserPlus className="w-3 h-3 mr-1" />
          Standby ({standbyMembers.length})
        </Button>
      </div>

      {/* Controles de Pirâmide compactos */}
      <div className="absolute top-2 right-2 z-10">
        <PyramidLevelControls
          levelMetrics={levelMetrics}
          visibleLevels={visibleLevels}
          focusedLevel={focusedLevel}
          onToggleLevel={toggleLevel}
          onFocusLevel={focusOnLevel}
        />
      </div>

      {/* Métricas da Rede compactas */}
      <div className="absolute bottom-2 left-2 z-10">
        <NetworkMetrics 
          levelMetrics={levelMetrics}
          totalConnected={connectedMembers.length}
          totalStandby={standbyMembers.length}
        />
      </div>

      {/* Painel de Standby */}
      {showStandby && (
        <div className="absolute bottom-2 right-2 z-10">
          <StandbyPanel members={standbyMembers} />
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        attributionPosition="bottom-right"
        className="bg-gradient-to-br from-blue-50 to-purple-50"
        minZoom={0.3}
        maxZoom={2}
      >
        <Controls className="bg-white/95 backdrop-blur-sm shadow-md rounded-md" />
        {showMiniMap && (
          <MiniMap 
            className="bg-white/95 backdrop-blur-sm shadow-md rounded-md border"
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              const nodeData = node.data as unknown as CustomNodeData;
              return getLevelColor(nodeData.member.level);
            }}
            style={{ width: 120, height: 80 }}
          />
        )}
        <Background variant={BackgroundVariant.Dots} gap={15} size={0.5} />
      </ReactFlow>
    </div>
  );
};

// Funções auxiliares
function calculateMemberLevel(memberId: string, members: MemberNode[]): number {
  const member = members.find(m => m.id === memberId);
  if (!member || !member.referredBy) return 0;
  return 1 + calculateMemberLevel(member.referredBy, members);
}

function calculateTotalDescendants(memberId: string, members: MemberNode[]): number {
  const member = members.find(m => m.id === memberId);
  if (!member) return 0;
  
  let total = member.referrals.length;
  member.referrals.forEach(childId => {
    total += calculateTotalDescendants(childId, members);
  });
  
  return total;
}

// Layout mais compacto e centralizado
function calculateCompactPosition(member: MemberNode, allMembers: MemberNode[]) {
  const baseY = 40;
  const levelSpacing = 120; // Menor espaçamento vertical
  const siblingSpacing = 200; // Menor espaçamento horizontal
  
  // Membros do mesmo nível e mesmo pai
  const siblings = allMembers.filter(m => m.referredBy === member.referredBy && m.level === member.level);
  const siblingIndex = siblings.findIndex(s => s.id === member.id);
  
  // Posição X mais centralizada
  const levelWidth = Math.max(1, siblings.length);
  const centerOffset = (siblingIndex - (levelWidth - 1) / 2) * siblingSpacing;
  
  // Reduzir indentação por nível
  const levelIndent = member.level * 20;
  
  const x = 300 + centerOffset - levelIndent;
  const y = baseY + member.level * levelSpacing;
  
  return { x, y };
}

function getLevelColor(level: number): string {
  const colors = [
    '#8B5CF6', // Nível 0 - Roxo (Pastores)
    '#3B82F6', // Nível 1 - Azul (Líderes)
    '#10B981', // Nível 2 - Verde (Discipuladores)
    '#F59E0B', // Nível 3 - Amarelo (Em Formação)
    '#EF4444', // Nível 4 - Vermelho (Novos)
    '#6B7280', // Outros níveis - Cinza
  ];
  return colors[level] || colors[colors.length - 1];
}
