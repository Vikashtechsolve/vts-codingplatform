import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  Handle,
  Position,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './ArchitectureBuilder.css';

const COMPONENT_CATEGORIES = [
  {
    label: 'Networking',
    items: [
      { type: 'dns', label: 'DNS', icon: '🌐' },
      { type: 'cdn', label: 'CDN', icon: '📡' },
      { type: 'load_balancer', label: 'Load Balancer', icon: '⚖️' },
      { type: 'api_gateway', label: 'API Gateway', icon: '🚪' },
      { type: 'firewall', label: 'Firewall', icon: '🛡️' },
    ]
  },
  {
    label: 'Compute',
    items: [
      { type: 'web_server', label: 'Web Server', icon: '🖥️' },
      { type: 'app_server', label: 'App Server', icon: '⚙️' },
      { type: 'microservice', label: 'Microservice', icon: '🔷' },
      { type: 'worker', label: 'Worker', icon: '👷' },
      { type: 'serverless', label: 'Serverless', icon: '⚡' },
    ]
  },
  {
    label: 'Storage',
    items: [
      { type: 'sql_db', label: 'SQL Database', icon: '🗄️' },
      { type: 'nosql_db', label: 'NoSQL Database', icon: '📊' },
      { type: 'object_storage', label: 'Object Storage', icon: '📦' },
      { type: 'file_system', label: 'File System', icon: '📂' },
      { type: 'data_warehouse', label: 'Data Warehouse', icon: '🏢' },
    ]
  },
  {
    label: 'Caching',
    items: [
      { type: 'redis', label: 'Redis', icon: '🔴' },
      { type: 'memcached', label: 'Memcached', icon: '🟢' },
      { type: 'local_cache', label: 'Local Cache', icon: '💨' },
    ]
  },
  {
    label: 'Messaging',
    items: [
      { type: 'message_queue', label: 'Message Queue', icon: '📬' },
      { type: 'event_bus', label: 'Event Bus', icon: '🔔' },
      { type: 'pub_sub', label: 'Pub/Sub', icon: '📢' },
      { type: 'stream', label: 'Stream Processor', icon: '🌊' },
    ]
  },
  {
    label: 'Other',
    items: [
      { type: 'search_engine', label: 'Search Engine', icon: '🔍' },
      { type: 'rate_limiter', label: 'Rate Limiter', icon: '🚦' },
      { type: 'monitoring', label: 'Monitoring', icon: '📈' },
      { type: 'service_registry', label: 'Service Registry', icon: '📋' },
    ]
  }
];

const ALL_COMPONENTS = COMPONENT_CATEGORIES.flatMap(c => c.items);

const VALIDATION_RULES_MAP = {
  requireLoadBalancer: { check: (nodes) => nodes.some(n => n.data?.componentType === 'load_balancer'), message: 'Consider adding a Load Balancer for distributing traffic.' },
  requireCache: { check: (nodes) => nodes.some(n => ['redis', 'memcached', 'local_cache'].includes(n.data?.componentType)), message: 'Consider adding a caching layer for better performance.' },
  requireMessageQueue: { check: (nodes) => nodes.some(n => ['message_queue', 'event_bus', 'pub_sub', 'stream'].includes(n.data?.componentType)), message: 'Consider adding a message queue for async processing.' },
  requireCDN: { check: (nodes) => nodes.some(n => n.data?.componentType === 'cdn'), message: 'Consider adding a CDN for static content delivery.' },
  requireDatabase: { check: (nodes) => nodes.some(n => ['sql_db', 'nosql_db'].includes(n.data?.componentType)), message: 'Your design should include a database.' },
  requireAPIGateway: { check: (nodes) => nodes.some(n => n.data?.componentType === 'api_gateway'), message: 'Consider adding an API Gateway for routing and security.' },
};

function CustomNode({ data }) {
  return (
    <div className="arch-custom-node">
      <Handle type="target" position={Position.Top} className="arch-handle" />
      <Handle type="target" position={Position.Left} id="left" className="arch-handle" />
      <div className="arch-node-icon">{data.icon}</div>
      <div className="arch-node-label">{data.label}</div>
      {data.subtitle && <div className="arch-node-subtitle">{data.subtitle}</div>}
      <Handle type="source" position={Position.Bottom} className="arch-handle" />
      <Handle type="source" position={Position.Right} id="right" className="arch-handle" />
    </div>
  );
}

const nodeTypes = { architectureComponent: CustomNode };

const ArchitectureBuilder = ({ diagramData, textExplanation, onChange, validationRules, templates }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(diagramData?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(diagramData?.edges || []);
  const { screenToFlowPosition } = useReactFlow();
  const [text, setText] = useState(textExplanation || '');
  const [warnings, setWarnings] = useState([]);
  const [dismissedWarnings, setDismissedWarnings] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Run validation whenever nodes change
  useEffect(() => {
    if (!validationRules) return;
    const activeWarnings = [];
    Object.entries(VALIDATION_RULES_MAP).forEach(([key, rule]) => {
      if (validationRules[key] && !rule.check(nodes)) {
        activeWarnings.push({ type: key, message: rule.message });
      }
    });
    setWarnings(activeWarnings.filter(w => !dismissedWarnings.includes(w.type)));
  }, [nodes, validationRules, dismissedWarnings]);

  // Notify parent of changes
  useEffect(() => {
    const components = nodes.map(n => n.data?.label).filter(Boolean);
    const diagramObj = { nodes, edges };
    onChange(diagramObj, text, components);
  }, [nodes, edges, text, onChange]);

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#6c5ce7', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6c5ce7', width: 20, height: 20 },
    }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/architectureComponent');
    if (!type) return;

    const component = ALL_COMPONENTS.find(c => c.type === type);
    if (!component) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${type}-${Date.now()}`,
      type: 'architectureComponent',
      position,
      data: { label: component.label, icon: component.icon, componentType: type },
    };

    setNodes(nds => [...nds, newNode]);
  }, [screenToFlowPosition, setNodes]);

  const loadTemplate = (templateName) => {
    if (!templates) return;
    const template = templates.find(t => t.name === templateName);
    if (template?.diagramData) {
      setNodes(template.diagramData.nodes || []);
      setEdges(template.diagramData.edges || []);
      setSelectedTemplate(templateName);
    }
  };

  const clearCanvas = () => {
    if (window.confirm('Clear all components?')) {
      setNodes([]);
      setEdges([]);
    }
  };

  const onDragStart = (event, componentType) => {
    event.dataTransfer.setData('application/architectureComponent', componentType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="arch-builder">
      {/* Toolbar */}
      <div className="arch-toolbar">
        {templates && templates.length > 0 && (
          <select value={selectedTemplate} onChange={e => loadTemplate(e.target.value)} className="arch-template-select">
            <option value="">Load Template...</option>
            {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        )}
        <button className="arch-clear-btn" onClick={clearCanvas}>Clear Canvas</button>
      </div>

      <div className="arch-workspace">
        {/* Component Palette */}
        <div className="arch-palette">
          <h3 className="arch-palette-title">Components</h3>
          {COMPONENT_CATEGORIES.map(cat => (
            <div key={cat.label} className="arch-palette-category">
              <h4>{cat.label}</h4>
              <div className="arch-palette-items">
                {cat.items.map(item => (
                  <div
                    key={item.type}
                    className="arch-palette-item"
                    draggable
                    onDragStart={e => onDragStart(e, item.type)}
                  >
                    <span className="arch-palette-icon">{item.icon}</span>
                    <span className="arch-palette-label">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* React Flow Canvas - onDrop/onDragOver must be on the wrapper div */}
        <div
          className="arch-canvas-wrap"
          ref={reactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>
      </div>

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="arch-warnings">
          {warnings.map(w => (
            <div key={w.type} className="arch-warning">
              <span className="arch-warning-icon">⚠️</span>
              <span className="arch-warning-text">{w.message}</span>
              <button className="arch-warning-dismiss" onClick={() => setDismissedWarnings(prev => [...prev, w.type])}>Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* Text Explanation */}
      <div className="arch-text-section">
        <label>Explain your architecture choices:</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="Describe why you chose these components and how they work together..."
        />
      </div>
    </div>
  );
};

const ArchitectureBuilderWrapper = (props) => (
  <ReactFlowProvider>
    <ArchitectureBuilder {...props} />
  </ReactFlowProvider>
);

export default ArchitectureBuilderWrapper;
