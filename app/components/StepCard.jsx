import React from "react";

export default function StepCard({ step, index, onUpdate, onRemove, dragHandleProps }) {
  
  const handleBrowse = async () => {
    const selectionIds = step.collectionId ? [{ id: step.collectionId }] : [];
    try {
      const response = await window.shopify.resourcePicker({
        type: "collection",
        multiple: false,
        selectionIds: selectionIds,
        filter: { hidden: true, variants: false, draft: false, archived: false },
      });

      if (response && response.length > 0) {
        const selectedCollection = response[0];
        onUpdate(step.id, { 
          collection: selectedCollection.title, 
          collectionId: selectedCollection.id 
        });
      }
    } catch (error) {
      console.log("Resource picker cancelled", error);
    }
  };

  return (
    <s-box padding="base" border="base" borderRadius="base" background="surface">
      <s-stack direction="inline" gap="base" alignItems="center" width="100%">
        
        {/* NEW DRAG HANDLE: Using direct SVG for guaranteed visibility */}
        <div 
            {...dragHandleProps} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'grab', 
              touchAction: 'none',
              paddingRight: '10px'
            }}
            title="Drag to reorder"
        >
           <svg 
             viewBox="0 0 20 20" 
             width="20" 
             height="20" 
             fill="#5c5f62" // Subdued color standard
           >
             <path d="M7 2a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17 2a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM7 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM7 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z" />
           </svg>
        </div>

        {/* Numbering */}
        <div style={{ minWidth: "24px" }}>
            <s-text variant="bodySm" color="subdued">{index + 1}.</s-text>
        </div>

        <s-box flex="1">
          <s-text-field 
            value={step.title} 
            placeholder="Step Title" 
            width="100%"
            onChange={(e) => onUpdate(step.id, { title: e.target.value })}
          />
        </s-box>

        <s-box flex="1">
          <s-text-field 
            value={step.collection} 
            placeholder="Linked Collection" 
            readonly
            width="100%"
          />
        </s-box>

        <s-button onClick={handleBrowse}>Browse</s-button>

        <s-button plain icon="delete" tone="critical" onClick={() => onRemove(step.id)} />

      </s-stack>
    </s-box>
  );
}