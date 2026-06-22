export type User = {
  id: number
  username: string
}

export type Category = {
  id: number
  name: string
}

export type ProblemState = {
  is_passed: boolean
  has_failed: boolean
  is_wrong_resolved: boolean
}

export type TestCase = {
  id: number
  stdin: string
  expected_stdout: string
  is_public: boolean
  order: number
}

export type Difficulty = {
  value: string
  label: string
}

export type Problem = {
  id: number
  title: string
  description: string
  difficulty: string
  difficulty_label: string
  category: Category | null
  input_description: string
  output_description: string
  sample_input: string
  sample_output: string
  starter_code: string
  explanation: string
  is_published: boolean
  created_at: string
  updated_at: string
  state: ProblemState
  test_cases?: TestCase[]
  public_test_cases?: TestCase[]
}

export type ProblemListResponse = {
  problems: Problem[]
  categories: Category[]
  difficulties: Difficulty[]
}

export type Submission = {
  id: number
  problem: {
    id: number
    title: string
    category: string
    difficulty: string
    difficulty_label: string
  }
  is_passed: boolean
  passed_count: number
  total_count: number
  error_message: string
  created_at: string
}

export type PracticeStatsResponse = {
  stats: {
    practiced_count: number
    passed_count: number
    failed_count: number
    pass_rate: number
  }
  recent_submissions: Submission[]
}

export type WrongProblem = {
  id: number
  problem: {
    id: number
    title: string
    category: string
    difficulty: string
    difficulty_label: string
  }
  wrong_count: number
  last_wrong_at: string | null
  is_resolved: boolean
}

export type WrongProblemListResponse = {
  wrong_problems: WrongProblem[]
}

