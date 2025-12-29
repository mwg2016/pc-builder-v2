export default function StepCard({ step, index, onUpdate, onRemove, dragHandleProps, disableAllBtn }) {
  const handleBrowse = async () => {
    try {
      const response = await window.shopify.resourcePicker({
        type: "collection",
        multiple: false,
        selectionIds: step.collectionId ? [{ id: step.collectionId }] : [],
        filter: { hidden: true, variants: false, draft: false, archived: false },
      });

      if (response?.[0]) {
        const { title, id } = response[0];
        onUpdate(step.id, { collection: title, collectionId: id });
      }
    } catch {}
  };

  return (
    <s-box padding="base" border="base" borderRadius="base" background="surface">
      <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between" width="100%">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-box cursor="grab" {...dragHandleProps}>
            {/* <svg viewBox="0 0 20 20" width="20" height="20" fill="#5c5f62">
              <path d="M7 2a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17 2a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM7 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM7 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z" />
            </svg> */}
            <s-icon type="drag-drop" />

          </s-box>
          <s-text variant="bodySm" color="subdued">{index + 1}.</s-text>
        </s-stack>

        <s-box flex="1">
          <s-text-field 
            value={step.title} 
            placeholder="Step Title" 
            width="100%"
            onChange={(e) => onUpdate(step.id, { title: e.target.value })}
            error={!step.title.trim() ? "Required" : undefined}
            readOnly={disableAllBtn}
          />
        </s-box>

        
        <s-box flex="1">
          <s-text-field 
            value={step.collection} 
            placeholder="-" 
            width="100%"
            readOnly
          />
        </s-box>

        <s-button variant="primary" onClick={handleBrowse} disabled={disableAllBtn}>
          {step.collectionId ? "Change Collection" : "Select Collection"}
        </s-button>

        <s-button plain icon="delete" tone="critical" onClick={() => onRemove(step.id)} disabled={disableAllBtn} />
      </s-stack>
    </s-box>
  );
}