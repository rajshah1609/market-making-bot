import * as types from "../actions/types";

const initialData = {
  status: {
    success: null,
    error: null,
    data: null,
    loading: false,
    ts: null,
    v: 0,
  },
  form: {
    success: null,
    error: null,
    data: null,
    loading: false,
    ts: null,
    v: 0,
  },
  forceStart: {
    success: null,
    error: null,
    data: null,
    loading: false,
    ts: null,
    v: 0,
  },
};

export default function (state = initialData, action) {
  switch (action.type) {
    case types.VOLUMEBOT_UPDATE_START: {
      return {
        ...state,
        form: {
          ...state.form,
          loading: true,
          success: null,
          error: null,
          ts: Date.now(),
        },
      };
    }
    case types.VOLUMEBOT_UPDATE_SUCCESS: {
      return {
        ...state,
        form: {
          ...state.form,
          success: action.success || null,
          data: action.data,
          error: null,
          isLoggedIn: true,
          v: state.v + 1,
        },
      };
    }

    case types.VOLUMEBOT_UPDATE_FAIL: {
      return {
        ...state,
        form: {
          ...state.form,
          success: null,
          error: action.error,
          v: state.v + 1,
        },
      };
    }

    case types.VOLUMEBOT_UPDATE_FINISH: {
      return {
        ...state,
        form: {
          ...state.form,
          loading: false,
          ts: Date.now(),
          error: null,
          success: null,
        },
      };
    }

    /**
     *
     *
     *
     *
     */

    case types.VOLUMEBOT_GET_START: {
      return {
        ...state,
        status: {
          ...state.status,
          loading: true,
          success: null,
          error: null,
          ts: Date.now(),
        },
      };
    }
    case types.VOLUMEBOT_GET_SUCCESS: {
      return {
        ...state,
        status: {
          ...state.status,
          success: action.success || null,
          data: action.data,
          error: null,
          isLoggedIn: true,
          v: state.v + 1,
        },
      };
    }

    case types.VOLUMEBOT_GET_FAIL: {
      return {
        ...state,
        status: {
          ...state.status,
          success: null,
          error: action.error,
          v: state.v + 1,
        },
      };
    }

    case types.VOLUMEBOT_GET_FINISH: {
      return {
        ...state,
        status: {
          ...state.status,
          loading: false,
          ts: Date.now(),
          error: null,
          success: null,
        },
      };
    }

    /**
     *
     *
     *
     *
     */

    case types.VOLUMEBOT_FORCE_START_START: {
      return {
        ...state,
        forceStart: {
          ...state.forceStart,
          loading: true,
          success: null,
          error: null,
          ts: Date.now(),
        },
      };
    }
    case types.VOLUMEBOT_FORCE_START_SUCCESS: {
      return {
        ...state,
        forceStart: {
          ...state.forceStart,
          success: action.success || null,
          data: action.data,
          error: null,
          isLoggedIn: true,
          v: state.v + 1,
        },
      };
    }

    case types.VOLUMEBOT_FORCE_START_FAIL: {
      return {
        ...state,
        forceStart: {
          ...state.forceStart,
          success: null,
          error: action.error,
          v: state.v + 1,
        },
      };
    }

    case types.VOLUMEBOT_FORCE_START_FINISH: {
      return {
        ...state,
        forceStart: {
          ...state.forceStart,
          loading: false,
          ts: Date.now(),
          error: null,
          success: null,
        },
      };
    }

    default:
      return state;
  }
}
