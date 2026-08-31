import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Photo } from '../lib/photos';
import { colors } from '../lib/theme';

/**
 * The car's gallery: photos with no log entry attached.
 *
 * Read-only when `onAdd` is omitted, which is how a published passport and an
 * inherited previous owner's gallery render — the same component, no branching
 * at the call site.
 */
export function Gallery({
  photos,
  onAdd,
  onRemove,
  onCaption,
  busy,
}: {
  photos: Photo[];
  onAdd?: () => void;
  onRemove?: (photo: Photo) => Promise<void>;
  onCaption?: (photo: Photo, caption: string) => Promise<void>;
  busy?: boolean;
}) {
  const [viewing, setViewing] = useState<Photo | null>(null);
  const editable = Boolean(onRemove || onCaption);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.heading}>Gallery</Text>
        {onAdd && (
          <Pressable onPress={onAdd} disabled={busy} hitSlop={8}>
            {busy ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.add}>+ Add photos</Text>
            )}
          </Pressable>
        )}
      </View>

      {photos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {onAdd
              ? 'Photos of the car itself, with no service record attached.'
              : 'No photos yet.'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              style={styles.tile}
              onPress={() => setViewing(photo)}
            >
              <Image source={{ uri: photo.url }} style={styles.tileImage} />
              {photo.caption ? <View style={styles.tileCaptionDot} /> : null}
            </Pressable>
          ))}
        </View>
      )}

      <PhotoViewer
        photo={viewing}
        editable={editable}
        onClose={() => setViewing(null)}
        onRemove={
          onRemove
            ? async (photo) => {
                await onRemove(photo);
                setViewing(null);
              }
            : undefined
        }
        onCaption={onCaption}
      />
    </View>
  );
}

function PhotoViewer({
  photo,
  editable,
  onClose,
  onRemove,
  onCaption,
}: {
  photo: Photo | null;
  editable: boolean;
  onClose: () => void;
  onRemove?: (photo: Photo) => Promise<void>;
  onCaption?: (photo: Photo, caption: string) => Promise<void>;
}) {
  const [caption, setCaption] = useState('');
  const [dirty, setDirty] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Load the caption when a different photo is opened. Comparing against the
  // photo id rather than using an effect keeps this in one render pass.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (photo && loadedFor !== photo.id) {
    setLoadedFor(photo.id);
    setCaption(photo.caption ?? '');
    setDirty(false);
    setConfirmingRemove(false);
  }

  if (!photo) return null;

  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <ScrollView contentContainerStyle={styles.viewerScroll}>
          <View style={styles.viewer}>
            <Image
              source={{ uri: photo.url }}
              style={[styles.viewerImage, { aspectRatio }]}
              resizeMode="contain"
            />

            {editable && onCaption ? (
              <View style={styles.captionBlock}>
                <TextInput
                  style={styles.captionInput}
                  value={caption}
                  onChangeText={(text) => {
                    setCaption(text);
                    setDirty(true);
                  }}
                  placeholder="Say something about this shot"
                  placeholderTextColor={colors.disabled}
                  multiline
                />
                {dirty && (
                  <Pressable
                    style={styles.captionSave}
                    disabled={working}
                    onPress={async () => {
                      setWorking(true);
                      await onCaption(photo, caption);
                      setDirty(false);
                      setWorking(false);
                    }}
                  >
                    <Text style={styles.captionSaveText}>
                      {working ? 'Saving…' : 'Save caption'}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : photo.caption ? (
              <Text style={styles.readOnlyCaption}>{photo.caption}</Text>
            ) : null}

            <View style={styles.viewerActions}>
              <Pressable style={styles.viewerClose} onPress={onClose}>
                <Text style={styles.viewerCloseText}>Close</Text>
              </Pressable>

              {onRemove && (
                <Pressable
                  style={styles.viewerRemove}
                  disabled={working}
                  onPress={async () => {
                    if (!confirmingRemove) {
                      setConfirmingRemove(true);
                      return;
                    }
                    setWorking(true);
                    await onRemove(photo);
                  }}
                >
                  <Text style={styles.viewerRemoveText}>
                    {confirmingRemove ? 'Tap again to delete' : 'Delete photo'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  add: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 20,
  },
  emptyText: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: {
    width: '32.4%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  tileImage: { width: '100%', height: '100%' },
  tileCaptionDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },

  viewerBackdrop: { flex: 1, backgroundColor: '#000000E6' },
  viewerScroll: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  viewer: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  viewerImage: { width: '100%', borderRadius: 6, backgroundColor: colors.surface },

  captionBlock: { gap: 10 },
  captionInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    fontSize: 15,
    padding: 12,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  captionSave: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  captionSaveText: { color: colors.background, fontSize: 13, fontWeight: '700' },

  readOnlyCaption: { color: colors.text, fontSize: 15, lineHeight: 21 },

  viewerActions: { flexDirection: 'row', gap: 10 },
  viewerClose: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: 4,
    paddingVertical: 13,
    alignItems: 'center',
  },
  viewerCloseText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  viewerRemove: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 13,
    alignItems: 'center',
  },
  viewerRemoveText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
