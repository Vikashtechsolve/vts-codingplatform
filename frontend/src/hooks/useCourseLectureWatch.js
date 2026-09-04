import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../utils/axios';

/**
 * Loads lecture + outline without unmounting the watch shell on lecture switches.
 */
const useCourseLectureWatch = ({ courseId, lectureId, role }) => {
  const isVendor = role === 'vendor';
  const lecturePath = isVendor
    ? `/vendor-admin/courses/${courseId}/lectures/${lectureId}`
    : `/student/courses/${courseId}/lectures/${lectureId}`;
  const playbackPath = `${lecturePath}/playback`;
  const coursePath = `/student/courses/${courseId}`;

  const outlineRef = useRef(null);
  const courseIdRef = useRef(courseId);
  if (courseIdRef.current !== courseId) {
    outlineRef.current = null;
    courseIdRef.current = courseId;
  }
  const [booting, setBooting] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const [lecture, setLecture] = useState(null);
  const [progress, setProgress] = useState(null);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [resumePosition, setResumePosition] = useState(0);
  const [outline, setOutline] = useState(null);

  const load = useCallback(async () => {
    const hasShell = !!outlineRef.current;
    if (hasShell) setSwitching(true);
    else setBooting(true);
    setError('');

    try {
      const lecRes = await axiosInstance.get(lecturePath);
      const lec = lecRes.data.lecture;
      setLecture(lec);
      setProgress(isVendor ? null : lecRes.data.progress);

      if (isVendor) {
        const nextOutline = {
          course: lecRes.data.course,
          modules: lecRes.data.modules,
        };
        outlineRef.current = nextOutline;
        setOutline(nextOutline);
      } else if (!hasShell) {
        const { data } = await axiosInstance.get(coursePath);
        outlineRef.current = data;
        setOutline(data);
      } else {
        axiosInstance
          .get(coursePath)
          .then(({ data }) => {
            outlineRef.current = data;
            setOutline(data);
          })
          .catch(() => {});
      }

      if (lec?.video?.status === 'ready') {
        const play = await axiosInstance.post(playbackPath);
        setPlaylistUrl(play.data.playlistUrl || '');
        setResumePosition(play.data.resumePosition || 0);
      } else {
        setPlaylistUrl('');
        setResumePosition(0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load lecture');
      if (!outlineRef.current) {
        setLecture(null);
        setPlaylistUrl('');
      }
    } finally {
      setBooting(false);
      setSwitching(false);
    }
  }, [coursePath, isVendor, lecturePath, playbackPath]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    booting,
    switching,
    error,
    lecture,
    progress,
    playlistUrl,
    resumePosition,
    outline,
  };
};

export default useCourseLectureWatch;
