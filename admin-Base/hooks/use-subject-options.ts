import { useEffect, useMemo, useState } from "react"
import { appApi, type SubjectInfo } from "@/lib/api"

export function useSubjectOptions() {
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    appApi.listSubjects()
      .then((items) => {
        if (active) setSubjects(items)
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "主体信息加载失败")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const options = useMemo(() => subjects.map((subject) => ({
    label: subject.subjectNameCn,
    value: subject.subjectId,
  })), [subjects])

  return { subjects, options, loading, error }
}
