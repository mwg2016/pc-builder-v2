import { useState } from "react";
import { Modal, TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import axios from "axios";
import { useNavigate } from "react-router";

export default function WidgetsIndex({ loaderWidgets = [], shopId }) {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deleteWidgetId, setDeleteWidgetId] = useState(null);

  const [widgets, setWidgets] = useState(
    loaderWidgets.map((w) => ({
      ...w,
      createdAt: new Date(w.createdAt),
      isNew: false,
    }))
  );

  const addWidget = () => {
    setWidgets((prev) => [
      {
        id: crypto.randomUUID(),
        name: `Widget ${prev.length + 1}`,
        status: "ACTIVE",
        createdAt: new Date(),
        isNew: true,
      },
      ...prev,
    ]);
  };

  const updateNewWidget = (id, patch) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  };

  const saveWidget = async (widget) => {
    if (!widget.name.trim()) return;

    setLoading(true);

    const { data } = await axios.post("/api/widgets", {
      name: widget.name.trim(),
      status: widget.status,
      shopId,
    });

    if (data.success) {
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === widget.id
            ? { ...data.widget, createdAt: new Date(data.widget.createdAt), isNew: false }
            : w
        )
      );
      shopify.toast.show("Widget Created Successfully");
    }

    setLoading(false);
  };

  const confirmDelete = (id) => {
    setDeleteWidgetId(id);
    shopify.modal.show("delete-widget-modal");
  };

  const deleteWidget = async () => {
    setLoading(true);

    const { data } = await axios.delete(
      `/api/widgets?id=${encodeURIComponent(deleteWidgetId)}`
    );

    if (data.success) {
      setWidgets((prev) => prev.filter((w) => w.id !== deleteWidgetId));
      shopify.modal.hide("delete-widget-modal");
      shopify.toast.show("Widget Deleted Successfully");
    }

    setLoading(false);
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

  const deleteWidgetData = widgets.find((w) => w.id === deleteWidgetId);
  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); shopify.toast.show("ID copied to clipboard");}

  return (
    <s-page fullWidth title="Edit Widget">
      <s-section padding="none">
        <s-stack direction="inline" justifyContent="space-between" padding="base">
          <s-heading>PC Builder Widgets</s-heading>
          <s-button variant="primary" onClick={addWidget} disabled={loading}>
            Add Widget
          </s-button>
        </s-stack>
        {widgets.length === 0 ? (
            <s-card>
              <s-stack 
                direction="block" 
                alignItems="center" 
                justifyContent="center" 
                padding="base" 
                gap="loose"
              >
                <s-stack direction="block" alignItems="center" gap="extraTight">
                  <s-heading>No Widget added yet</s-heading>
                  <s-text tone="subdued" alignment="center">
                    Add your first Widget to get started.
                  </s-text>
                </s-stack>
              </s-stack>
            </s-card>
          ) : (
        <s-table>
          <s-table-header-row>
            <s-table-header>Name</s-table-header>
            <s-table-header>ID</s-table-header>
            <s-table-header>Status</s-table-header>
            <s-table-header>Created</s-table-header>
            <s-table-header>Actions</s-table-header>
          </s-table-header-row>

          <s-table-body>
            {widgets.map((widget) => (
              <s-table-row key={widget.id}>
                <s-table-cell>
                  {widget.isNew ? (
                    <s-text-field
                      value={widget.name}
                      onInput={(e) =>
                        updateNewWidget(widget.id, { name: e.target.value })
                      }
                    />
                  ) : (
                    <s-clickable fontWeight="bold" href={`/app/edit-widget/${widget.id}`}>{widget.name}</s-clickable>
                  )}
                </s-table-cell>

                <s-table-cell>
                  <s-clickable>
                    <s-stack 
                      direction="inline" 
                      gap="extra-tight" 
                      alignItems="center"
                    >
                      <s-text tone="caution" onClick={() => !widget.isNew && copyToClipboard(widget.id)}>
                        {widget.isNew ? "—" : widget.id}
                      </s-text>
                      {!widget.isNew && <s-icon tone="caution" type="clipboard" size="extraSmall" onClick={() =>copyToClipboard(widget.id)}/>}
                    </s-stack>
                  </s-clickable>
                </s-table-cell>

                <s-table-cell>
                  {widget.isNew ? (
                    <s-select
                      value={widget.status}
                      onChange={(e) =>
                        updateNewWidget(widget.id, { status: e.target.value })
                      }
                    >
                      <s-option value="ACTIVE">ACTIVE</s-option>
                      <s-option value="INACTIVE">INACTIVE</s-option>
                    </s-select>
                  ) : (
                    <s-badge
                      tone={widget.status === "ACTIVE" ? "success" : "critical"}
                    >
                      {widget.status}
                    </s-badge>
                  )}
                </s-table-cell>

                <s-table-cell>
                  {widget.isNew ? "—" : formatDate(widget.createdAt)}
                </s-table-cell>

                <s-table-cell>
                  {widget.isNew ? (
                    <s-stack direction="inline" gap="small">
                      <s-button
                        size="slim"
                        variant="primary"
                        loading={loading}
                        disabled={loading || !widget.name.trim()}
                        onClick={() => saveWidget(widget)}
                      >
                        Save
                      </s-button>
                      <s-button
                        size="slim"
                        tone="critical"
                        icon="delete"
                        disabled={loading}
                        onClick={() =>
                          setWidgets((prev) => prev.filter((w) => w.id !== widget.id))
                        }
                      />
                    </s-stack>
                  ) : (
                    <s-stack direction="inline" gap="small">
                      <s-button
                        size="slim"
                        icon="edit"
                        disabled={loading}
                        onClick={() => navigate(`/app/edit-widget/${widget.id}`)}
                      />
                      <s-button
                        size="slim"
                        tone="critical"
                        icon="delete"
                        disabled={loading}
                        onClick={() => confirmDelete(widget.id)}
                      />
                    </s-stack>
                  )}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>)}

        <Modal id="delete-widget-modal">
          {deleteWidgetData && (
            <s-section padding="large">
              <s-text-field label="Name" value={deleteWidgetData.name} disabled />
              <s-text-field label="ID" value={deleteWidgetData.id} disabled />
              <s-text-field
                label="Created"
                value={formatDate(deleteWidgetData.createdAt)}
                disabled
              />
            </s-section>
          )}

          <TitleBar title="Confirm Delete"> 
            <button  variant="primary" disabled={loading} loading={loading} onClick={deleteWidget} > Delete </button> 
            <button disabled={loading} onClick={() => shopify.modal.hide("delete-widget-modal")} > Close </button> 
          </TitleBar>
        </Modal>
      </s-section>
    </s-page>
  );
}
