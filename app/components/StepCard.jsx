import React from "react";

// Added dragHandleProps to the arguments
export default function StepCard({ step, index, onUpdate, onRemove, onSave, dragHandleProps }) {
  
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
        
        {/* ATTACH DRAG LISTENERS HERE */}
        <s-stack 
            direction="inline" 
            alignItems="center" 
            gap="xs" 
            {...dragHandleProps} 
        >
          <s-icon name="drag-handle" color="subdued" />
          <s-text variant="bodySm" color="subdued">{index + 1}</s-text>
        </s-stack>

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

        {step.isUnsaved && (
          <s-button variant="primary" onClick={() => onSave(step.id)}>
            Save
          </s-button>
        )}

        <s-button plain icon="delete" tone="critical" onClick={() => onRemove(step.id)} />

      </s-stack>
    </s-box>
  );
}