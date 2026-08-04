import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { PlusIcon, TrashIcon, RenameIcon, CheckIcon, CrossIcon } from '../../components/ForestIcons';
import { useAppStore } from '../../store/appStore';
import type { Owner, Tag } from '../../shared/contracts/types';
import * as bridge from '../../api/nativeBridge';

type EditingState = { id: number; name: string } | null;

export function ManagementPanel() {
  const owners = useAppStore((state) => state.owners);
  const tags = useAppStore((state) => state.tags);
  const refreshMetadata = useAppStore((state) => state.refreshMetadata);
  const refreshTree = useAppStore((state) => state.refreshTree);

  const [activeSection, setActiveSection] = useState<'owners' | 'tags'>('owners');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [editingOwner, setEditingOwner] = useState<EditingState>(null);
  const [editingTag, setEditingTag] = useState<EditingState>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    clearError();
  }, [activeSection, clearError]);

  const handleAddOwner = async () => {
    const trimmed = newOwnerName.trim();
    if (!trimmed) { return; }
    setError(null);
    try {
      await bridge.createOwner(trimmed);
      setNewOwnerName('');
      await refreshMetadata();
      await refreshTree();
    } catch (backendError) {
      setError(String(backendError));
    }
  };

  const handleAddTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) { return; }
    setError(null);
    try {
      await bridge.createTag(trimmed);
      setNewTagName('');
      await refreshMetadata();
      await refreshTree();
    } catch (backendError) {
      setError(String(backendError));
    }
  };

  const handleRenameOwner = async (id: number) => {
    if (!editingOwner || !editingOwner.name.trim()) {
      setEditingOwner(null);
      return;
    }
    setError(null);
    try {
      await bridge.renameOwner(id, editingOwner.name.trim());
      setEditingOwner(null);
      await refreshMetadata();
      await refreshTree();
    } catch (backendError) {
      setError(String(backendError));
    }
  };

  const handleRenameTag = async (id: number) => {
    if (!editingTag || !editingTag.name.trim()) {
      setEditingTag(null);
      return;
    }
    setError(null);
    try {
      await bridge.renameTag(id, editingTag.name.trim());
      setEditingTag(null);
      await refreshMetadata();
      await refreshTree();
    } catch (backendError) {
      setError(String(backendError));
    }
  };

  const handleDeleteOwner = async (id: number, name: string) => {
    if (!window.confirm(`确定删除负责人「${name}」？\n该操作会清除引用此负责人的所有任务中的负责人信息。`)) {
      return;
    }
    setError(null);
    try {
      await bridge.deleteOwner(id);
      await refreshMetadata();
      await refreshTree();
    } catch (backendError) {
      setError(String(backendError));
    }
  };

  const handleDeleteTag = async (id: number, name: string) => {
    if (!window.confirm(`确定删除标签「${name}」？\n该操作会清除所有任务中的此标签。`)) {
      return;
    }
    setError(null);
    try {
      await bridge.deleteTag(id);
      await refreshMetadata();
      await refreshTree();
    } catch (backendError) {
      setError(String(backendError));
    }
  };

  const handleKeyDown = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter') {
      action();
    }
  };

  return (
    <div className="management-panel">
      <div className="management-tabs">
        <button
          type="button"
          className={`management-tab${activeSection === 'owners' ? ' active' : ''}`}
          onClick={() => setActiveSection('owners')}
        >
          负责人
          <span className="management-tab-count">{owners.length}</span>
        </button>
        <button
          type="button"
          className={`management-tab${activeSection === 'tags' ? ' active' : ''}`}
          onClick={() => setActiveSection('tags')}
        >
          标签
          <span className="management-tab-count">{tags.length}</span>
        </button>
      </div>

      <div className="management-content">
        {activeSection === 'owners' && (
          <div className="management-list">
            <div className="management-add-row">
              <input
                type="text"
                className="management-add-input"
                placeholder="输入负责人名称..."
                value={newOwnerName}
                onChange={(event) => setNewOwnerName(event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, handleAddOwner)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAddOwner}
                disabled={!newOwnerName.trim()}
                title="添加负责人"
              >
                <PlusIcon size={13} />
                添加
              </button>
            </div>

            {owners.length === 0 && (
              <p className="management-empty">暂无负责人,在任务中设置负责人后会自动创建。</p>
            )}

            {owners.map((owner: Owner) => (
              <div key={owner.id} className="management-item">
                {editingOwner?.id === owner.id ? (
                  <>
                    <input
                      type="text"
                      className="management-item-input"
                      value={editingOwner.name}
                      onChange={(event) =>
                        setEditingOwner({ ...editingOwner, name: event.target.value })
                      }
                      onKeyDown={(event) => handleKeyDown(event, () => handleRenameOwner(owner.id))}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="management-item-icon ok"
                      onClick={() => handleRenameOwner(owner.id)}
                      title="确认"
                    >
                      <CheckIcon size={13} />
                    </button>
                    <button
                      type="button"
                      className="management-item-icon cancel"
                      onClick={() => setEditingOwner(null)}
                      title="取消"
                    >
                      <CrossIcon size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="management-item-name">{owner.name}</span>
                    <div className="management-item-actions">
                      <button
                        type="button"
                        className="management-item-icon"
                        onClick={() => setEditingOwner({ id: owner.id, name: owner.name })}
                        title="重命名"
                      >
                        <RenameIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="management-item-icon danger"
                        onClick={() => handleDeleteOwner(owner.id, owner.name)}
                        title="删除"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {activeSection === 'tags' && (
          <div className="management-list">
            <div className="management-add-row">
              <input
                type="text"
                className="management-add-input"
                placeholder="输入标签名称..."
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, handleAddTag)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAddTag}
                disabled={!newTagName.trim()}
                title="添加标签"
              >
                <PlusIcon size={13} />
                添加
              </button>
            </div>

            {tags.length === 0 && (
              <p className="management-empty">暂无标签,在任务中设置标签后会自动创建。</p>
            )}

            {tags.map((tag: Tag) => (
              <div key={tag.id} className="management-item">
                {editingTag?.id === tag.id ? (
                  <>
                    <input
                      type="text"
                      className="management-item-input"
                      value={editingTag.name}
                      onChange={(event) =>
                        setEditingTag({ ...editingTag, name: event.target.value })
                      }
                      onKeyDown={(event) => handleKeyDown(event, () => handleRenameTag(tag.id))}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="management-item-icon ok"
                      onClick={() => handleRenameTag(tag.id)}
                      title="确认"
                    >
                      <CheckIcon size={13} />
                    </button>
                    <button
                      type="button"
                      className="management-item-icon cancel"
                      onClick={() => setEditingTag(null)}
                      title="取消"
                    >
                      <CrossIcon size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="management-item-name">{tag.name}</span>
                    <div className="management-item-actions">
                      <button
                        type="button"
                        className="management-item-icon"
                        onClick={() => setEditingTag({ id: tag.id, name: tag.name })}
                        title="重命名"
                      >
                        <RenameIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="management-item-icon danger"
                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                        title="删除"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="modal-error management-error">{error}</div>}
    </div>
  );
}
