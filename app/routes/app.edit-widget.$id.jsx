import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useActionData, useNavigation, useNavigate } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { arrayMove } from "@dnd-kit/sortable";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import AddSteps from "../components/AddSteps";

export const loader = async ({ request, params }) => {
  try {
    await authenticate.admin(request);
    const { id } = params;

    const widgetList = await prisma.WidgetList.findFirst({ where: { id } });
    if (!widgetList) return new Response(JSON.stringify({ widgetList: null }), { status: 404 });

    const dbSteps = await prisma.Widget.findMany({
      where: { widget_id: id },
      orderBy: { order: "asc" },
    });

    const formattedSteps = dbSteps.map((step) => ({
      id: String(step.sno),
      title: step.collection_name || "",
      collection: step.selected_collection || "",
      collectionId: step.collection_id || "",
    }));

    return new Response(JSON.stringify({ widgetList, initialSteps: formattedSteps }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Server Error" }), { status: 500 });
  }
};

export const action = async ({ request, params }) => {
  try {
    await authenticate.admin(request);
    const { id: widgetId } = params;
    const formData = await request.formData();
    
    const submittedSteps = JSON.parse(formData.get("steps"));
    const newName = formData.get("widgetName");
    const newStatus = formData.get("widgetStatus");

    const currentWidgetList = await prisma.WidgetList.findFirst({ where: { id: widgetId } });
    const currentDbSteps = await prisma.Widget.findMany({
      where: { widget_id: widgetId },
      select: { sno: true, collection_name: true, collection_id: true, order: true }
    });

    const ops = [];

    // Compare WidgetList details
    if (currentWidgetList.name !== newName || currentWidgetList.status !== newStatus) {
      ops.push(prisma.WidgetList.update({
        where: { id: widgetId },
        data: { name: newName, status: newStatus, updatedAt: new Date() }
      }));
    }

    // Compare Steps
    const dbStepMap = new Map(currentDbSteps.map(s => [s.sno, s]));
    const processedIds = new Set();

    submittedSteps.forEach((step, index) => {
      const isExisting = /^\d+$/.test(step.id);
      
      if (isExisting) {
        const dbId = parseInt(step.id);
        processedIds.add(dbId);
        const existing = dbStepMap.get(dbId);

        if (existing) {
          const data = {};
          if (existing.collection_name !== step.title) data.collection_name = step.title;
          if (existing.collection_id !== step.collectionId) data.collection_id = step.collectionId;
          if (existing.selected_collection !== step.collection) data.selected_collection = step.collection;
          if (existing.order !== index) data.order = index;

          if (Object.keys(data).length > 0) {
            ops.push(prisma.Widget.update({ where: { sno: dbId }, data: { ...data, updated_at: new Date() } }));
          }
        }
      } else {
        ops.push(prisma.Widget.create({
          data: {
            widget_id: widgetId,
            collection_name: step.title,
            collection_id: step.collectionId,
            order: index
          }
        }));
      }
    });

    const idsToDelete = currentDbSteps
      .filter(s => !processedIds.has(s.sno))
      .map(s => s.sno);

    if (idsToDelete.length > 0) {
      ops.push(prisma.Widget.deleteMany({ where: { sno: { in: idsToDelete } } }));
    }

    if (ops.length > 0) await prisma.$transaction(ops);

    return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ status: "error", message: error.message }), { status: 500 });
  }
};

export default function EditWidget() {
  const { widgetList, initialSteps: serverSteps } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [initialSteps, setInitialSteps] = useState(serverSteps || []);
  const [steps, setSteps] = useState(serverSteps || []);
  const [initialMeta, setInitialMeta] = useState({ name: widgetList.name, status: widgetList.status });
  const [meta, setMeta] = useState({ name: widgetList.name, status: widgetList.status });
  const [requiredBlank, setRequiredBlank] = useState(false);

  const isLoading = nav.state === "submitting" || nav.state === "loading";

  useEffect(() => {
    const stepsChanged = JSON.stringify(steps) !== JSON.stringify(initialSteps);
    const metaChanged = JSON.stringify(meta) !== JSON.stringify(initialMeta);
    
    if (stepsChanged || metaChanged) shopify.saveBar.show("my-save-bar");
    else shopify.saveBar.hide("my-save-bar");
  }, [steps, initialSteps, meta, initialMeta, shopify]);

  useEffect(() => {
    if (actionData?.status === "success") {
      shopify.toast.show("Saved successfully");
      setInitialSteps(steps);
      setInitialMeta(meta);
      shopify.saveBar.hide("my-save-bar");
    } else if (actionData?.status === "error") {
      shopify.toast.show("Save failed", { isError: true });
    }
  }, [actionData, shopify]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(widgetList.id);
    shopify.toast.show("ID copied to clipboard");
  };

  const handleAddStep = () => {
    const newId = `temp-${Date.now()}`;
    setSteps([...steps, { id: newId, title: "New Step", collection: "", collectionId: "" }]);
  };

  const handleRemoveStep = (id) => setSteps(steps.filter((s) => s.id !== id));

  const updateStep = (id, updates) => {
    setRequiredBlank(updates.title === '' ? true : false)
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over.id) {
      setSteps(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDiscard = () => {
    setSteps(initialSteps);
    setMeta(initialMeta);
    shopify.saveBar.hide("my-save-bar");
  };

  const handleSave = () => {
    submit({ 
      steps: JSON.stringify(steps), 
      widgetName: meta.name, 
      widgetStatus: meta.status 
    }, { method: "post" });
  };

  if (!widgetList) return <s-page>Widget not found</s-page>;

  return (
    <s-page fullWidth title="Edit Widget">
      <SaveBar id="my-save-bar">
        <button variant="primary" onClick={handleSave} disabled={isLoading || requiredBlank}>Save</button>
        <button onClick={handleDiscard} disabled={isLoading}>Discard</button>
      </SaveBar>

      <s-stack direction="block" gap="large" padding="base" maxWidth="100%" margin="auto">
        
        <s-card>
          <s-stack direction="inline" justifyContent="space-between" alignItems="center" padding="base" gap="large" wrap={false}>
            {/* Left: Navigation and ID Info */}
            <s-stack gap="base" alignItems="center" direction="inline">
              <s-button icon="arrow-left" plain onClick={() => navigate("/app")} />
              
              <s-stack gap="none">
                
                <s-stack 
                  direction="inline" 
                  gap="extra-tight" 
                  alignItems="center" 
                  onClick={handleCopyId} 
                  style={{ cursor: "pointer", opacity: 0.7 }}
                >
                  <s-text variant="bodyXs" color="subdued">ID: {widgetList.id}</s-text>
                  <s-icon type="clipboard" size="extraSmall" tone="subdued"/>
                </s-stack>
              </s-stack>
            </s-stack>

            {/* Right: Inputs */}
            <s-stack direction="inline" gap="base" flex="1" justifyContent="end" alignItems="end">
              <s-box flex="1" maxWidth="400px">
                <s-text-field 
                  label="Name"
                  value={meta.name} 
                  placeholder="Widget Title" 
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                  autoComplete="off"
                  readOnly={isLoading}
                />
              </s-box>
              
              <s-box width="150px">
                <s-select
                  label="Status"
                  value={meta.status}
                  disabled={isLoading}
                  onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
                  <s-option value="ACTIVE">ACTIVE</s-option>
                  <s-option value="INACTIVE">INACTIVE</s-option>
                </s-select>
              </s-box>
            </s-stack>
          </s-stack>
        </s-card>

        <AddSteps
          steps={steps}
          onAdd={handleAddStep}
          onRemove={handleRemoveStep}
          onUpdate={updateStep}
          onDragEnd={handleDragEnd}
          disableAllBtn={isLoading}
        />
      </s-stack>
    </s-page>
  );
}