import { useState } from "react";
import { Modal, TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import axios from "axios";

export default function WidgetsIndex({ loaderWidgets = [], shopId }) {
  const shopify = useAppBridge();
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

  return (
    <s-section padding="none">
      <s-stack direction="inline" justifyContent="space-between" padding="base">
        <s-heading>PC Builder Widgets</s-heading>
        <s-button variant="primary" onClick={addWidget}>
          Add Widget
        </s-button>
      </s-stack>

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
                  <s-text fontWeight="bold">{widget.name}</s-text>
                )}
              </s-table-cell>

              <s-table-cell>
                <s-text tone="subdued">
                  {widget.isNew ? "—" : widget.id}
                </s-text>
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
                      onClick={() =>
                        setWidgets((prev) => prev.filter((w) => w.id !== widget.id))
                      }
                    />
                  </s-stack>
                ) : (
                  <s-button
                    size="slim"
                    tone="critical"
                    icon="delete"
                    onClick={() => confirmDelete(widget.id)}
                  />
                )}
              </s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>

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
          <button  variant="primary" disabled={loading} onClick={deleteWidget} > Delete </button> 
          <button  onClick={() => shopify.modal.hide("delete-widget-modal")} > Close </button> 
        </TitleBar>
      </Modal>
    </s-section>
  );
}
