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
import { colors, radius, type } from '../lib/theme';
import { Button, SectionHeader, focusRing, type PressState } from './ui';

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
      <SectionHeader
        title="Gallery"
        action={
          onAdd ? (
            busy ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Button label="Add photos" variant="quiet" onPress={onAdd} />
            )
          ) : undefined
        }
      />

      {photos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {onAdd
              ? 'Photos of the car itself: how it looks, where it has been. The first one becomes the photo on its passport.'
              : 'No photos yet.'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              style={(state) => [styles.tile, (state as PressState).focused && focusRing]}
              onPress={() => setViewing(photo)}
              accessibilityRole="imagebutton"
              accessibilityLabel={photo.caption || 'Open photo'}
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
                  placeholderTextColor={colors.textFaint}
                  multiline
                />
                {dirty && (
                  <Button
                    label="Save caption"
                    busy={working}
                    style={styles.captionSave}
                    onPress={async () => {
                      setWorking(true);
                      await onCaption(photo, caption);
                      setDirty(false);
                      setWorking(false);
                    }}
                  />
                )}
              </View>
            ) : photo.caption ? (
              <Text style={styles.readOnlyCaption}>{photo.caption}</Text>
            ) : null}

            <View style={styles.viewerActions}>
              <Button label="Close" variant="secondary" onPress={onClose} style={styles.viewerButton} />

              {onRemove && (
                <Button
                  label={confirmingRemove ? 'Tap again to delete' : 'Delete photo'}
                  variant="danger"
                  disabled={working}
                  style={styles.viewerButton}
                  onPress={async () => {
                    if (!confirmingRemove) {
                      setConfirmingRemove(true);
                      return;
                    }
                    setWorking(true);
                    await onRemove(photo);
                  }}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.page,
    padding: 20,
  },
  emptyText: { ...type.small, color: colors.textFaint },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: {
    width: '32.5%',
    aspectRatio: 1,
    borderRadius: radius.photo,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  tileImage: { width: '100%', height: '100%' },
  tileCaptionDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.paper,
  },

  viewerBackdrop: { flex: 1, backgroundColor: '#0A1512F2' },
  viewerScroll: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  viewer: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 },
  viewerImage: { width: '100%', borderRadius: radius.photo, backgroundColor: colors.surface },

  captionBlock: { gap: 10 },
  captionInput: {
    ...type.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    color: colors.text,
    padding: 12,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  captionSave: { alignSelf: 'flex-start', minHeight: 44 },

  readOnlyCaption: { ...type.body, color: colors.text },

  viewerActions: { flexDirection: 'row', gap: 10 },
  viewerButton: { flex: 1 },
});
